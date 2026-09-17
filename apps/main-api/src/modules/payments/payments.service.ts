import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import Razorpay from 'razorpay';
import { DataSource, Repository } from 'typeorm';
import {
  DEFAULT_CURRENCY,
  ErrorCode,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RAZORPAY_EVENT,
  WebhookStatus,
} from '@app/contracts';
import { DomainException, Money } from '@app/common';
import { OrderEntity, PaymentEntity, WebhookEventEntity } from '@app/database';

interface RazorpayWebhook {
  event: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(PaymentEntity)
    private readonly payments: Repository<PaymentEntity>,
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async create(customerId: number, orderId: number) {
    const order = await this.orders.findOneBy({ id: orderId });
    if (!order) throw new NotFoundException(ErrorCode.ORDER_NOT_FOUND);
    if (order.customerId !== customerId) throw new ForbiddenException();
    if (
      order.paymentMethod !== PaymentMethod.ONLINE ||
      order.paymentStatus !== PaymentStatus.PENDING
    )
      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        'Order is not eligible for online payment',
      );
    const providerOrder = await this.provider().orders.create({
      amount: Money.fromDecimal(order.totalAmount).toMinorUnitsNumber(),
      currency: DEFAULT_CURRENCY,
      receipt: order.orderNumber,
    });
    const payment = await this.payments.save(
      this.payments.create({
        orderId: order.id,
        provider: PaymentProvider.RAZORPAY,
        providerOrderId: providerOrder.id,
        amount: order.totalAmount,
        currency: DEFAULT_CURRENCY,
        status: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.ONLINE,
      }),
    );
    return {
      paymentId: payment.id,
      providerOrderId: providerOrder.id,
      amount: providerOrder.amount,
      currency: providerOrder.currency,
    };
  }

  async verify(
    customerId: number,
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ) {
    const payment = await this.payments.findOne({
      where: { providerOrderId },
      relations: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.order.customerId !== customerId) throw new ForbiddenException();
    const expected = this.hmac(
      `${providerOrderId}|${providerPaymentId}`,
      this.credential('RAZORPAY_KEY_SECRET'),
    );
    if (!this.safeEqual(expected, signature))
      throw new DomainException(
        ErrorCode.PAYMENT_VERIFICATION_FAILED,
        'Payment signature is invalid',
      );
    payment.providerPaymentId = providerPaymentId;
    payment.providerSignature = signature;
    payment.status = PaymentStatus.PAID;
    payment.paidAt = new Date();
    payment.order.paymentStatus = PaymentStatus.PAID;
    await this.dataSource.transaction(async (manager) => {
      await manager.save(PaymentEntity, payment);
      await manager.save(OrderEntity, payment.order);
    });
    return payment;
  }

  async webhook(
    eventId: string | undefined,
    rawBody: Buffer,
    signature: string,
    payload: RazorpayWebhook,
  ): Promise<void> {
    const expected = this.hmac(
      rawBody,
      this.credential('RAZORPAY_WEBHOOK_SECRET'),
    );
    if (!this.safeEqual(expected, signature))
      throw new DomainException(
        ErrorCode.PAYMENT_VERIFICATION_FAILED,
        'Webhook signature is invalid',
      );
    const idempotencyKey = eventId || expected;
    await this.dataSource.transaction(async (manager) => {
      if (
        await manager.exists(WebhookEventEntity, {
          where: {
            provider: PaymentProvider.RAZORPAY,
            eventId: idempotencyKey,
          },
        })
      )
        return;
      const event = await manager.save(
        WebhookEventEntity,
        manager.create(WebhookEventEntity, {
          provider: PaymentProvider.RAZORPAY,
          eventId: idempotencyKey,
          eventType: payload.event,
          payload: payload as unknown as Record<string, unknown>,
          status: WebhookStatus.PENDING,
        }),
      );
      const providerOrderId = payload.payload?.payment?.entity?.order_id;
      if (
        providerOrderId &&
        [
          RAZORPAY_EVENT.PAYMENT_CAPTURED,
          RAZORPAY_EVENT.PAYMENT_FAILED,
        ].includes(payload.event as never)
      ) {
        const payment = await manager.findOne(PaymentEntity, {
          where: { providerOrderId },
          relations: { order: true },
        });
        if (payment) {
          const success = payload.event === RAZORPAY_EVENT.PAYMENT_CAPTURED;
          payment.status = success ? PaymentStatus.PAID : PaymentStatus.FAILED;
          payment.providerPaymentId =
            payload.payload?.payment?.entity?.id ?? null;
          payment.paidAt = success ? new Date() : null;
          payment.failedAt = success ? null : new Date();
          payment.order.paymentStatus = payment.status;
          await manager.save(PaymentEntity, payment);
          await manager.save(OrderEntity, payment.order);
        }
      }
      event.status = WebhookStatus.PROCESSED;
      event.processedAt = new Date();
      await manager.save(WebhookEventEntity, event);
    });
  }

  private provider(): Razorpay {
    return new Razorpay({
      key_id: this.credential('RAZORPAY_KEY_ID'),
      key_secret: this.credential('RAZORPAY_KEY_SECRET'),
    });
  }
  private credential(key: string): string {
    const value = this.config.get<string>(key);
    if (!value)
      throw new DomainException(
        ErrorCode.PAYMENT_FAILED,
        `${key} is not configured`,
      );
    return value;
  }
  private hmac(value: string | Buffer, secret: string) {
    return createHmac('sha256', secret).update(value).digest('hex');
  }
  private safeEqual(expected: string, received: string) {
    const left = Buffer.from(expected);
    const right = Buffer.from(received);
    return left.length === right.length && timingSafeEqual(left, right);
  }
}
