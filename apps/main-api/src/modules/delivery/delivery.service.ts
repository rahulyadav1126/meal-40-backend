import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { openDeliveryOtp, sealDeliveryOtp } from '@app/common';
import { randomInt } from 'node:crypto';
import { enqueueEvent } from '../realtime/outbox.js';
import { hash, verify } from 'argon2';
import { DataSource, In, Repository } from 'typeorm';
import {
  DeliveryPartnerApprovalStatus,
  DeliveryStatus,
  ErrorCode,
  NotificationType,
  ORDER_TRANSITIONS,
  OrderStatus,
  SOCKET_EVENT,
  UserStatus,
  PaymentMethod,
  PaymentStatus,
  VerificationStatus,
  JobStatus,
} from '@app/contracts';
import {
  DeliveryEarningEntity,
  DeliveryEntity,
  DeliveryPartnerDocumentEntity,
  DeliveryPartnerEntity,
  NotificationEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
  UserEntity,
  BackgroundJobEntity,
} from '@app/database';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { OrderStateService } from '../orders/services/order-state.service.js';
import { EmailNotificationService } from '../notifications/email-notification.service.js';

const ACTIVE_DELIVERY_STATUSES = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ARRIVED_AT_MERCHANT,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.OUT_FOR_DELIVERY,
  DeliveryStatus.ARRIVED_AT_CUSTOMER,
];

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(DeliveryPartnerEntity)
    private readonly partners: Repository<DeliveryPartnerEntity>,
    @InjectRepository(DeliveryPartnerDocumentEntity)
    private readonly documents: Repository<DeliveryPartnerDocumentEntity>,
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: Repository<DeliveryEntity>,
    @InjectRepository(DeliveryEarningEntity)
    private readonly earningsRepo: Repository<DeliveryEarningEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItems: Repository<OrderItemEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    private readonly orderStates: OrderStateService,
    private readonly realtime: RealtimeGateway,
    private readonly emailNotifications: EmailNotificationService,
  ) {}

  async profile(userId: number) {
    const partner = await this.partner(userId);
    const documents = await this.documents.find({
      where: { deliveryPartnerId: partner.id },
    });
    return { ...partner, documents };
  }

  async setOnline(userId: number, isOnline: boolean) {
    const partner = await this.approvedPartner(userId);
    return this.dataSource.transaction(async manager => {
    const current = await manager.findOneOrFail(DeliveryPartnerEntity, { where: { id: partner.id }, lock: { mode: 'pessimistic_write' } });
    if (current.approvalStatus !== DeliveryPartnerApprovalStatus.APPROVED) throw new ForbiddenException('Partner is not approved');
    if (!isOnline) {
      const active = await manager.exists(DeliveryEntity, {
        where: {
          deliveryPartnerId: partner.id,
          status: In(ACTIVE_DELIVERY_STATUSES),
        },
      });
      if (active)
        throw new BadRequestException(
          'Complete the active delivery before going offline',
        );
    }
    current.isOnline = isOnline;
    return manager.save(current);
    });
  }

  async available(userId: number) {
    const partner = await this.approvedPartner(userId);
    if (!partner.isOnline) return [];
    const deliveries = await this.deliveries.find({
      where: { status: DeliveryStatus.AVAILABLE },
      relations: {
        order: { restaurant: true, address: true, customer: true },
      },
      order: { createdAt: 'ASC' },
    });
    // Before assignment expose only pickup and offer economics, never customer PII.
    return deliveries.filter(delivery => !delivery.rejectedPartnerIds?.some(id => Number(id) === Number(partner.id))).map(delivery => ({
      id: delivery.id, orderId: delivery.orderId, status: delivery.status, deliveryPartnerId: null,
      distanceKm: delivery.distanceKm, deliveryFee: delivery.deliveryFee, estimatedMinutes: delivery.estimatedMinutes,
      order: { id: delivery.order.id, orderNumber: delivery.order.orderNumber, restaurantId: delivery.order.restaurantId,
        restaurant: { name: delivery.order.restaurant.name, addressLine1: delivery.order.restaurant.addressLine1, city: delivery.order.restaurant.city, state: delivery.order.restaurant.state, latitude: delivery.order.restaurant.latitude, longitude: delivery.order.restaurant.longitude } },
    }));
  }

  async active(userId: number) {
    const partner = await this.partner(userId);
    return this.withItems(
      await this.deliveries.find({
        where: {
          deliveryPartnerId: partner.id,
          status: In(ACTIVE_DELIVERY_STATUSES),
        },
        relations: {
          order: { restaurant: true, address: true, customer: true },
        },
        order: { createdAt: 'DESC' },
      }),
    );
  }

  async history(userId: number) {
    const partner = await this.partner(userId);
    return this.deliveries.find({
      where: { deliveryPartnerId: partner.id, status: In([DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED]) },
      relations: { order: { restaurant: true, address: true } },
      order: { createdAt: 'DESC' },
    });
  }

  async earnings(userId: number) {
    const partner = await this.partner(userId);
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);
    const week = new Date(today);
    week.setDate(week.getDate() - 6);
    const month = new Date(today.getFullYear(), today.getMonth(), 1);
    const row = await this.earningsRepo
      .createQueryBuilder('earning')
      .select('COALESCE(SUM(earning.totalAmount), 0)', 'total')
      .addSelect(
        'COALESCE(SUM(CASE WHEN earning.createdAt >= :today THEN earning.totalAmount ELSE 0 END), 0)',
        'today',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN earning.createdAt >= :week THEN earning.totalAmount ELSE 0 END), 0)',
        'week',
      )
      .addSelect(
        'COALESCE(SUM(CASE WHEN earning.createdAt >= :month THEN earning.totalAmount ELSE 0 END), 0)',
        'month',
      )
      .addSelect('COUNT(*)', 'completedDeliveries')
      .where('earning.deliveryPartnerId = :partnerId', {
        partnerId: partner.id,
        today,
        week,
        month,
      })
      .getRawOne<Record<string, string>>();
    const history = await this.earningsRepo.find({
      where: { deliveryPartnerId: partner.id },
      relations: { delivery: { order: { restaurant: true } } },
      order: { createdAt: 'DESC' },
    });
    return { ...row, history };
  }

  async accept(userId: number, deliveryId: number) {
    const partner = await this.approvedPartner(userId);
    if (!partner.isOnline)
      throw new ForbiddenException('Go online before accepting deliveries');
    const delivery = await this.dataSource.transaction(async (manager) => {
      const lockedPartner = await manager.findOneOrFail(DeliveryPartnerEntity, { where: { id: partner.id }, lock: { mode: 'pessimistic_write' } });
      if (!lockedPartner.isOnline || lockedPartner.approvalStatus !== DeliveryPartnerApprovalStatus.APPROVED) throw new ForbiddenException('Partner is not available');
      const alreadyAssigned = await manager.findOne(DeliveryEntity, { where: { id: deliveryId, deliveryPartnerId: partner.id } });
      if (alreadyAssigned) return alreadyAssigned;
      if (await manager.exists(DeliveryEntity, { where: { deliveryPartnerId: partner.id, status: In(ACTIVE_DELIVERY_STATUSES) } })) throw new BadRequestException('Finish your active delivery before accepting another');
      const locked = await manager
        .createQueryBuilder(DeliveryEntity, 'delivery')
        .setLock('pessimistic_write')
        .where('delivery.id = :deliveryId', { deliveryId })
        .getOne();
      if (!locked) throw new NotFoundException('Delivery not found');
      if (
        locked.status !== DeliveryStatus.AVAILABLE ||
        locked.deliveryPartnerId
      )
        throw new BadRequestException(ErrorCode.DELIVERY_ALREADY_ASSIGNED);
      if (locked.rejectedPartnerIds?.some(id => Number(id) === Number(partner.id)))
        throw new ForbiddenException('You rejected this delivery');
      const order = await manager.findOneOrFail(OrderEntity, {
        where: { id: locked.orderId }, lock: { mode: 'pessimistic_write' },
      });
      this.assertOrderTransition(order.orderStatus, OrderStatus.ASSIGNED);
      locked.deliveryPartnerId = partner.id;
      locked.status = DeliveryStatus.ASSIGNED;
      locked.assignedAt = new Date();
      await manager.save(DeliveryEntity, locked);
      await this.transitionOrder(manager, order, OrderStatus.ASSIGNED, userId);
      await enqueueEvent(manager, 'user', userId, SOCKET_EVENT.DELIVERY_UPDATED, { deliveryId: locked.id });
      return locked;
    });
    return this.emit(delivery, await this.orderForDelivery(delivery));
  }

  async reject(userId: number, deliveryId: number) {
    const partner = await this.approvedPartner(userId);
    return this.dataSource.transaction(async manager => {
    const delivery = await manager.findOne(DeliveryEntity, { where: {
      id: deliveryId,
      status: DeliveryStatus.AVAILABLE,
    }, lock: { mode: 'pessimistic_write' } });
    if (!delivery)
      throw new NotFoundException(ErrorCode.DELIVERY_NOT_AVAILABLE);
    delivery.rejectedPartnerIds = [
      ...new Set([...(delivery.rejectedPartnerIds ?? []), partner.id]),
    ];
    await manager.save(delivery);
    return { rejected: true };
    });
  }

  arriveMerchant(userId: number, id: number) {
    return this.deliveryStep(
      userId,
      id,
      DeliveryStatus.ASSIGNED,
      DeliveryStatus.ARRIVED_AT_MERCHANT,
      'arrivedMerchantAt',
    );
  }

  pickup(userId: number, id: number) {
    return this.deliveryStep(
      userId,
      id,
      DeliveryStatus.ARRIVED_AT_MERCHANT,
      DeliveryStatus.PICKED_UP,
      'pickedUpAt',
      OrderStatus.PICKED_UP,
    );
  }

  outForDelivery(userId: number, id: number) {
    return this.deliveryStep(
      userId,
      id,
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.OUT_FOR_DELIVERY,
      'outForDeliveryAt',
      OrderStatus.OUT_FOR_DELIVERY,
    );
  }

  async arriveCustomer(userId: number, id: number) {
    const result = await this.deliveryStep(
      userId,
      id,
      DeliveryStatus.OUT_FOR_DELIVERY,
      DeliveryStatus.ARRIVED_AT_CUSTOMER,
      'arrivedCustomerAt',
    );
    return result;
  }

  /**
   * Called by the durable worker. Decrypt only for this delivery's customer.
   */
  async sendDeliveryOtpNotifications(
    delivery: DeliveryEntity,
  ): Promise<void> {
    // Fetch the order to know the customer
    const order = await this.dataSource
      .getRepository(OrderEntity)
      .findOne({
        where: { id: delivery.orderId },
        relations: { customer: true },
      });
    if (!order?.customer) return;

    const customer = order.customer;

    const secret = await this.deliveries.createQueryBuilder('delivery').addSelect('delivery.otpCiphertext')
      .where('delivery.id = :id', { id: delivery.id }).getOne();
    const otp = secret?.otpCiphertext && secret.otpExpiresAt && secret.otpExpiresAt > new Date()
      ? openDeliveryOtp(secret.otpCiphertext, this.config.get<string>('DELIVERY_OTP_SECRET') || this.config.getOrThrow<string>('jwt.accessSecret')) : undefined;
    if (!otp) {
      this.logger.warn(
        `No OTP notification found for order ${order.id} — skipping email/SMS`,
      );
      return;
    }

    const orderNumber = order.orderNumber;

    // ── Email ──────────────────────────────────────────────────────────────────
    if (customer.email) {
      await this.emailNotifications.send({
          to: customer.email,
          templateKey: 'DELIVERY_OTP',
          variables: {
            name: customer.name,
            otp,
            orderNumber,
          },
        });
    } else {
      this.logger.warn(`Customer ${customer.id} has no email address`);
    }

  }

  async complete(userId: number, id: number, otp: string, cashCollected = false) {
    const partner = await this.partner(userId);
    const result = await this.dataSource.transaction(async manager => {
    const delivery = await manager.getRepository(DeliveryEntity)
      .createQueryBuilder('delivery')
      .addSelect('delivery.otpHash')
      .setLock('pessimistic_write')
      .where('delivery.id = :id', { id })
      .andWhere('delivery.deliveryPartnerId = :partnerId', {
        partnerId: partner.id,
      })
      .getOne();
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status === DeliveryStatus.DELIVERED) return { delivery, order: await manager.findOneByOrFail(OrderEntity, { id: delivery.orderId }), invalidOtp: false };
    if (delivery.status !== DeliveryStatus.ARRIVED_AT_CUSTOMER)
      throw new BadRequestException(
        'Mark arrival at the customer before delivery',
      );
    if (!delivery.otpExpiresAt || delivery.otpExpiresAt <= new Date())
      throw new BadRequestException(ErrorCode.OTP_EXPIRED);
    if (delivery.otpAttempts >= 5)
      throw new BadRequestException(ErrorCode.OTP_ATTEMPTS_EXCEEDED);
    if (!delivery.otpHash || !(await verify(delivery.otpHash, otp))) {
      delivery.otpAttempts += 1;
      await manager.save(delivery);
      return { delivery, order: null, invalidOtp: true };
    }
    const order = await manager.findOneOrFail(OrderEntity, { where: { id: delivery.orderId }, lock: { mode: 'pessimistic_write' } });
    this.assertOrderTransition(order.orderStatus, OrderStatus.DELIVERED);
    if (order.paymentMethod === PaymentMethod.COD && !cashCollected) throw new BadRequestException('Confirm cash collection before completing this COD delivery');
    order.deliveredAt = new Date();
    if (order.paymentMethod === PaymentMethod.COD) order.paymentStatus = PaymentStatus.PAID;
    await this.transitionOrder(manager, order, OrderStatus.DELIVERED, userId);
    delivery.status = DeliveryStatus.DELIVERED;
    delivery.deliveredAt = new Date();
    delivery.otpHash = null; delivery.otpCiphertext = null; delivery.lastLocation = null;
    await manager.save(delivery);
    const base = 30;
    const distance = Number(delivery.distanceKm) * 5;
    await manager.save(DeliveryEarningEntity,
      manager.create(DeliveryEarningEntity, {
        deliveryId: delivery.id,
        deliveryPartnerId: partner.id,
        baseAmount: base.toFixed(2),
        distanceAmount: distance.toFixed(2),
        tipAmount: '0.00',
        totalAmount: (base + distance).toFixed(2),
      }),
    );
    await enqueueEvent(manager, 'user', order.customerId, SOCKET_EVENT.ORDER_DELIVERED, { id: order.id });
    await enqueueEvent(manager, 'user', userId, SOCKET_EVENT.DELIVERY_UPDATED, { deliveryId: delivery.id });
    await enqueueEvent(manager, 'restaurant', order.restaurantId, SOCKET_EVENT.DELIVERY_UPDATED, { id: order.id });
    await enqueueEvent(manager, 'admin', null, SOCKET_EVENT.DELIVERY_UPDATED, { id: order.id });
    return { delivery, order, invalidOtp: false };
    });
    if (result.invalidOtp) throw new BadRequestException(ErrorCode.OTP_INVALID);
    const { otpHash: _hash, otpCiphertext: _cipher, ...safeDelivery } = result.delivery;
    return { delivery: safeDelivery, order: result.order };
  }

  async cancel(userId: number, id: number) {
    const partner = await this.partner(userId);
    const result = await this.dataSource.transaction(async manager => {
    const delivery = await manager.findOne(DeliveryEntity, {
      where: { id, deliveryPartnerId: partner.id }, lock: { mode: 'pessimistic_write' },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (
      delivery.status === DeliveryStatus.DELIVERED ||
      delivery.status === DeliveryStatus.CANCELLED
    )
      throw new BadRequestException(
        `Cannot cancel a ${delivery.status} delivery`,
      );

    const order = await manager.findOneOrFail(OrderEntity, { where: { id: delivery.orderId }, lock: { mode: 'pessimistic_write' } });
    this.assertOrderTransition(order.orderStatus, OrderStatus.CANCELLED);
    order.cancelledAt = new Date(); order.cancellationReason = 'Cancelled by delivery partner';
    await this.transitionOrder(manager, order, OrderStatus.CANCELLED, userId);

    delivery.status = DeliveryStatus.CANCELLED;
    delivery.otpCiphertext = null; delivery.otpHash = null; delivery.lastLocation = null;
    await manager.save(delivery);
    await enqueueEvent(manager, 'user', userId, SOCKET_EVENT.DELIVERY_UPDATED, { deliveryId: delivery.id });
    return { delivery, order };
    });
    return this.emit(result.delivery, result.order);
  }

  async listAdmin() {
    const partners = await this.partners.find({
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(
      partners.map(async (partner) => {
        const [
          documents,
          activeDeliveries,
          completedDeliveries,
          cancelledDeliveries,
          earnings,
        ] = await Promise.all([
          this.documents.find({ where: { deliveryPartnerId: partner.id } }),
          this.deliveries.count({
            where: {
              deliveryPartnerId: partner.id,
              status: In(ACTIVE_DELIVERY_STATUSES),
            },
          }),
          this.deliveries.countBy({
            deliveryPartnerId: partner.id,
            status: DeliveryStatus.DELIVERED,
          }),
          this.deliveries.countBy({
            deliveryPartnerId: partner.id,
            status: DeliveryStatus.CANCELLED,
          }),
          this.earningsRepo
            .createQueryBuilder('earning')
            .select('COALESCE(SUM(earning.totalAmount), 0)', 'total')
            .where('earning.deliveryPartnerId = :id', { id: partner.id })
            .getRawOne<{ total: string }>(),
        ]);
        return {
          ...partner,
          documents,
          activeDeliveries,
          completedDeliveries,
          cancelledDeliveries,
          totalEarnings: earnings?.total ?? '0.00',
        };
      }),
    );
  }

  listAdminDeliveries() {
    return this.deliveries.find({
      relations: {
        deliveryPartner: { user: true },
        order: { restaurant: true, customer: true },
      },
      order: { createdAt: 'DESC' },
    });
  }

  async adminStatus(id: number, approvalStatus: DeliveryPartnerApprovalStatus) {
    const partner = await this.partners.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!partner) throw new NotFoundException('Delivery partner not found');
    partner.approvalStatus = approvalStatus;
    partner.approvedAt =
      approvalStatus === DeliveryPartnerApprovalStatus.APPROVED
        ? new Date()
        : null;
    partner.isOnline =
      approvalStatus === DeliveryPartnerApprovalStatus.APPROVED &&
      partner.isOnline;
    partner.user.status =
      approvalStatus === DeliveryPartnerApprovalStatus.SUSPENDED
        ? UserStatus.SUSPENDED
        : UserStatus.ACTIVE;
    await this.users.save(partner.user);
    return this.partners.save(partner);
  }

  async verifyDocument(id: number, status: VerificationStatus) {
    const document = await this.documents.findOneBy({ id });
    if (!document) throw new NotFoundException('Document not found');
    document.status = status;
    document.verifiedAt =
      status === VerificationStatus.VERIFIED ? new Date() : null;
    return this.documents.save(document);
  }

  private async deliveryStep(
    userId: number,
    id: number,
    from: DeliveryStatus,
    to: DeliveryStatus,
    timestamp: keyof Pick<
      DeliveryEntity,
      | 'arrivedMerchantAt'
      | 'pickedUpAt'
      | 'outForDeliveryAt'
      | 'arrivedCustomerAt'
    >,
    orderStatus?: OrderStatus,
  ) {
    const partner = await this.partner(userId);
    const result = await this.dataSource.transaction(async manager => {
    const delivery = await manager.findOne(DeliveryEntity, {
      where: { id, deliveryPartnerId: partner.id }, lock: { mode: 'pessimistic_write' },
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    const order = await manager.findOneOrFail(OrderEntity, { where: { id: delivery.orderId }, lock: { mode: 'pessimistic_write' } });
    if (delivery.status === to) return { delivery, order };
    if (delivery.status !== from)
      throw new BadRequestException(
        `Cannot move delivery from ${delivery.status} to ${to}`,
      );
    if (orderStatus) {
      this.assertOrderTransition(order.orderStatus, orderStatus);
      if (orderStatus === OrderStatus.OUT_FOR_DELIVERY) order.outForDeliveryAt = new Date();
      await this.transitionOrder(manager, order, orderStatus, userId);
    }
    delivery.status = to;
    delivery[timestamp] = new Date();
    if (to === DeliveryStatus.ARRIVED_AT_CUSTOMER) {
      const code = String(randomInt(100000, 1000000));
      delivery.otpHash = await hash(code);
      delivery.otpCiphertext = sealDeliveryOtp(code, this.config.get<string>('DELIVERY_OTP_SECRET') || this.config.getOrThrow<string>('jwt.accessSecret'));
      delivery.otpExpiresAt = new Date(Date.now() + 30 * 60000);
      delivery.otpAttempts = 0;
    }
    await manager.save(delivery);
    if (to === DeliveryStatus.ARRIVED_AT_CUSTOMER) await manager.save(BackgroundJobEntity, manager.create(BackgroundJobEntity, {
      type: 'delivery-otp-email', payload: { deliveryId: delivery.id }, status: JobStatus.PENDING,
      attempts: 0, maxAttempts: 5, availableAt: new Date(),
    }));
    await enqueueEvent(manager, 'user', userId, SOCKET_EVENT.DELIVERY_UPDATED, { deliveryId: delivery.id });
    await enqueueEvent(manager, 'user', order.customerId, SOCKET_EVENT.DELIVERY_UPDATED, { id: order.id });
    await enqueueEvent(manager, 'restaurant', order.restaurantId, SOCKET_EVENT.DELIVERY_UPDATED, { id: order.id });
    return { delivery, order };
    });
    return this.emit(result.delivery, result.order);
  }

  private async partner(userId: number) {
    const partner = await this.partners.findOne({
      where: { userId },
      relations: { user: true },
    });
    if (!partner)
      throw new NotFoundException('Delivery partner profile not found');
    return partner;
  }

  private async withItems(deliveries: DeliveryEntity[]) {
    await Promise.all(
      deliveries.map(async (delivery) => {
        if (delivery.order.addressSnapshot) delivery.order.address = { ...delivery.order.address, ...delivery.order.addressSnapshot };
        (delivery.order as OrderEntity & { items: OrderItemEntity[] }).items =
          await this.orderItems.findBy({ orderId: delivery.orderId });
      }),
    );
    return deliveries;
  }

  private async approvedPartner(userId: number) {
    const partner = await this.partner(userId);
    if (partner.approvalStatus !== DeliveryPartnerApprovalStatus.APPROVED)
      throw new ForbiddenException(ErrorCode.DELIVERY_PARTNER_NOT_APPROVED);
    return partner;
  }

  private async orderForDelivery(delivery: DeliveryEntity) {
    const order = await this.dataSource
      .getRepository(OrderEntity)
      .findOneBy({ id: delivery.orderId });
    if (!order) throw new NotFoundException(ErrorCode.ORDER_NOT_FOUND);
    return order;
  }

  private emit(delivery: DeliveryEntity, order?: OrderEntity) {
    delete (delivery as Partial<DeliveryEntity>).otpHash;
    delete (delivery as Partial<DeliveryEntity>).otpCiphertext;
    const payload = { delivery, order };
    // Events are published by the transactional outbox, never a detached promise.
    return payload;
  }

  private assertOrderTransition(from: OrderStatus, to: OrderStatus) {
    if (!ORDER_TRANSITIONS[from].includes(to))
      throw new BadRequestException(
        `Cannot transition order from ${from} to ${to}`,
      );
  }

  private async transitionOrder(
    manager: import('typeorm').EntityManager,
    order: OrderEntity,
    to: OrderStatus,
    userId: number,
  ) {
    const oldStatus = order.orderStatus;
    order.orderStatus = to;
    await manager.save(OrderEntity, order);
    await manager.save(
      OrderStatusHistoryEntity,
      manager.create(OrderStatusHistoryEntity, {
        orderId: order.id,
        oldStatus,
        newStatus: to,
        changedByUserId: userId,
        note: null,
      }),
    );
    await enqueueEvent(manager, 'user', order.customerId, `order.${to.toLowerCase()}`, { id: order.id });
    await enqueueEvent(manager, 'restaurant', order.restaurantId, SOCKET_EVENT.DELIVERY_UPDATED, { id: order.id });
    await enqueueEvent(manager, 'admin', null, SOCKET_EVENT.DELIVERY_UPDATED, { id: order.id });
  }
}
