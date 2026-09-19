import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { verify } from 'argon2';
import { DataSource, In, Repository } from 'typeorm';
import {
  DeliveryPartnerApprovalStatus,
  DeliveryStatus,
  ErrorCode,
  ORDER_TRANSITIONS,
  OrderStatus,
  SOCKET_EVENT,
  UserStatus,
  VerificationStatus,
} from '@app/contracts';
import {
  DeliveryEarningEntity,
  DeliveryEntity,
  DeliveryPartnerDocumentEntity,
  DeliveryPartnerEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
  UserEntity,
} from '@app/database';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { OrderStateService } from '../orders/services/order-state.service.js';

const ACTIVE_DELIVERY_STATUSES = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ARRIVED_AT_MERCHANT,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.OUT_FOR_DELIVERY,
  DeliveryStatus.ARRIVED_AT_CUSTOMER,
];

@Injectable()
export class DeliveryService {
  constructor(
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
    private readonly orderStates: OrderStateService,
    private readonly realtime: RealtimeGateway,
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
    if (!isOnline) {
      const active = await this.deliveries.exists({
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
    partner.isOnline = isOnline;
    return this.partners.save(partner);
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
    return this.withItems(
      deliveries.filter(
        (delivery) => !delivery.rejectedPartnerIds?.includes(partner.id),
      ),
    );
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
      where: { deliveryPartnerId: partner.id },
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
      if (locked.rejectedPartnerIds?.includes(partner.id))
        throw new ForbiddenException('You rejected this delivery');
      const order = await manager.findOneByOrFail(OrderEntity, {
        id: locked.orderId,
      });
      this.assertOrderTransition(order.orderStatus, OrderStatus.ASSIGNED);
      locked.deliveryPartnerId = partner.id;
      locked.status = DeliveryStatus.ASSIGNED;
      locked.assignedAt = new Date();
      await manager.save(DeliveryEntity, locked);
      await this.transitionOrder(manager, order, OrderStatus.ASSIGNED, userId);
      return locked;
    });
    return this.emit(delivery, await this.orderForDelivery(delivery));
  }

  async reject(userId: number, deliveryId: number) {
    const partner = await this.approvedPartner(userId);
    const delivery = await this.deliveries.findOneBy({
      id: deliveryId,
      status: DeliveryStatus.AVAILABLE,
    });
    if (!delivery)
      throw new NotFoundException(ErrorCode.DELIVERY_NOT_AVAILABLE);
    delivery.rejectedPartnerIds = [
      ...new Set([...(delivery.rejectedPartnerIds ?? []), partner.id]),
    ];
    await this.deliveries.save(delivery);
    return { rejected: true };
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

  arriveCustomer(userId: number, id: number) {
    return this.deliveryStep(
      userId,
      id,
      DeliveryStatus.OUT_FOR_DELIVERY,
      DeliveryStatus.ARRIVED_AT_CUSTOMER,
      'arrivedCustomerAt',
    );
  }

  async complete(userId: number, id: number, otp: string) {
    const partner = await this.partner(userId);
    const delivery = await this.deliveries
      .createQueryBuilder('delivery')
      .addSelect('delivery.otpHash')
      .where('delivery.id = :id', { id })
      .andWhere('delivery.deliveryPartnerId = :partnerId', {
        partnerId: partner.id,
      })
      .getOne();
    if (!delivery) throw new NotFoundException('Delivery not found');
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
      await this.deliveries.save(delivery);
      throw new BadRequestException(ErrorCode.OTP_INVALID);
    }
    const order = await this.orderForDelivery(delivery);
    await this.orderStates.transition(
      order,
      OrderStatus.DELIVERED,
      userId,
      'Delivery OTP verified',
    );
    delivery.status = DeliveryStatus.DELIVERED;
    delivery.deliveredAt = new Date();
    await this.deliveries.save(delivery);
    const base = 30;
    const distance = Number(delivery.distanceKm) * 5;
    await this.earningsRepo.save(
      this.earningsRepo.create({
        deliveryId: delivery.id,
        deliveryPartnerId: partner.id,
        baseAmount: base.toFixed(2),
        distanceAmount: distance.toFixed(2),
        tipAmount: '0.00',
        totalAmount: (base + distance).toFixed(2),
      }),
    );
    return this.emit(delivery, order);
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
    const delivery = await this.deliveries.findOneBy({
      id,
      deliveryPartnerId: partner.id,
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== from)
      throw new BadRequestException(
        `Cannot move delivery from ${delivery.status} to ${to}`,
      );
    const order = await this.orderForDelivery(delivery);
    if (orderStatus)
      await this.orderStates.transition(order, orderStatus, userId);
    delivery.status = to;
    delivery[timestamp] = new Date();
    await this.deliveries.save(delivery);
    return this.emit(delivery, order);
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
    const payload = { delivery, order };
    if (delivery.deliveryPartnerId) {
      this.partners
        .findOneBy({ id: delivery.deliveryPartnerId })
        .then((partner) => {
          if (partner)
            this.realtime.emitToUser(
              partner.userId,
              SOCKET_EVENT.DELIVERY_UPDATED,
              payload,
            );
        });
    }
    if (order) {
      this.realtime.emitToUser(
        order.customerId,
        SOCKET_EVENT.DELIVERY_UPDATED,
        payload,
      );
      this.realtime.emitToRestaurant(
        order.restaurantId,
        SOCKET_EVENT.DELIVERY_UPDATED,
        payload,
      );
      this.realtime.emitToAdmin(SOCKET_EVENT.DELIVERY_UPDATED, payload);
    }
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
  }
}
