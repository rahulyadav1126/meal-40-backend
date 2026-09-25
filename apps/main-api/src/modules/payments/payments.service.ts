import {
  ForbiddenException,
  ConflictException,
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
  OrderStatus,
  SOCKET_EVENT,
  WebhookStatus,
} from '@app/contracts';
import { DomainException, Money } from '@app/common';
import { OrderEntity, PaymentEntity, WebhookEventEntity } from '@app/database';
import { enqueueEvent } from '../realtime/outbox.js';

interface RazorpayWebhook {
  event: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string } } };
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
    if (this.config.get<string>('ONLINE_PAYMENTS_ENABLED') !== 'true') throw new ForbiddenException('Online payments are not enabled');
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
    const reservation = await this.dataSource.transaction(async manager => {
      const locked = await manager.findOneOrFail(OrderEntity, { where: { id: orderId, customerId }, lock: { mode: 'pessimistic_write' } });
      if (locked.paymentStatus !== PaymentStatus.PENDING || [OrderStatus.CANCELLED, OrderStatus.REJECTED].includes(locked.orderStatus)) throw new ConflictException('Order is not eligible for payment');
      const existing = await manager.findOne(PaymentEntity, { where: { orderId, provider: PaymentProvider.RAZORPAY }, order: { id: 'DESC' } });
      if (existing) {
        if (!existing.providerOrderId) throw new ConflictException('Payment initiation is pending reconciliation. Do not start another payment.');
        return { payment: existing, existing: true };
      }
      const payment = await manager.save(PaymentEntity, manager.create(PaymentEntity, { orderId, provider: PaymentProvider.RAZORPAY, amount: locked.totalAmount, currency: DEFAULT_CURRENCY, status: PaymentStatus.PENDING, paymentMethod: PaymentMethod.ONLINE }));
      return { payment, existing: false };
    });
    if (reservation.existing) return { paymentId: reservation.payment.id, providerOrderId: reservation.payment.providerOrderId, amount: Money.fromDecimal(reservation.payment.amount).toMinorUnitsNumber(), currency: reservation.payment.currency };
    const providerOrder = await this.provider().orders.create({
      amount: Money.fromDecimal(order.totalAmount).toMinorUnitsNumber(),
      currency: DEFAULT_CURRENCY,
      receipt: order.orderNumber,
    });
    reservation.payment.providerOrderId = providerOrder.id;
    const payment = await this.payments.save(reservation.payment);
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
    const captured = await this.provider().payments.fetch(providerPaymentId);
    if (captured.order_id !== providerOrderId || Number(captured.amount) !== Money.fromDecimal(payment.amount).toMinorUnitsNumber() || captured.currency !== payment.currency) throw new ConflictException('Provider payment does not match this order');
    return this.dataSource.transaction(async manager => {
      const current = await manager.findOneOrFail(PaymentEntity, { where: { id: payment.id }, lock: { mode: 'pessimistic_write' } });
      const order = await manager.findOneOrFail(OrderEntity, { where: { id: current.orderId }, lock: { mode: 'pessimistic_write' } });
      current.providerPaymentId = providerPaymentId;
      if (captured.status === 'captured' && ![PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED].includes(current.status)) {
        current.status = PaymentStatus.PAID; current.paidAt = new Date(); order.paymentStatus = PaymentStatus.PAID;
        await manager.save(order);
        await enqueueEvent(manager, 'user', customerId, SOCKET_EVENT.PAYMENT_SUCCESS, { id: order.id });
      }
      await manager.save(current);
      return { id: current.id, status: current.status, orderId: current.orderId };
    });
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
          lock: { mode: 'pessimistic_write' },
        });
        if (payment) {
          payment.order = await manager.findOneOrFail(OrderEntity, { where: { id: payment.orderId }, lock: { mode: 'pessimistic_write' } });
          const success = payload.event === RAZORPAY_EVENT.PAYMENT_CAPTURED;
          const providerPayment = payload.payload?.payment?.entity;
          if (success && (providerPayment?.amount !== Money.fromDecimal(payment.amount).toMinorUnitsNumber() || providerPayment.currency !== payment.currency)) {
            throw new ConflictException('Webhook payment amount or currency does not match');
          }
          if ([PaymentStatus.PAID, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED].includes(payment.status)) {
            event.status = WebhookStatus.PROCESSED; event.processedAt = new Date(); await manager.save(event); return;
          }
          payment.status = success ? PaymentStatus.PAID : PaymentStatus.FAILED;
          payment.providerPaymentId =
            payload.payload?.payment?.entity?.id ?? null;
          payment.paidAt = success ? new Date() : null;
          payment.failedAt = success ? null : new Date();
          payment.order.paymentStatus = payment.status;
          await manager.save(PaymentEntity, payment);
          await manager.save(OrderEntity, payment.order);
          await enqueueEvent(manager, 'user', payment.order.customerId, success ? SOCKET_EVENT.PAYMENT_SUCCESS : SOCKET_EVENT.PAYMENT_FAILED, { id: payment.orderId });
        } else {
          throw new ConflictException('Payment is not registered yet; retry this webhook');
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
