import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { hash } from 'argon2';
import {
  DataSource,
  In,
  LessThanOrEqual,
  MoreThan,
  Repository,
} from 'typeorm';
import {
  DeliveryPartnerApprovalStatus,
  DeliveryStatus,
  ErrorCode,
  NotificationType,
  ORDER_NUMBER_PREFIX,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
  RestaurantApprovalStatus,
  RestaurantOpeningStatus,
  SOCKET_EVENT,
} from '@app/contracts';
import { DomainException, haversineDistanceKm, restaurantAvailability, menuAvailability, sealDeliveryOtp, openDeliveryOtp, Money } from '@app/common';
import { enqueueEvent } from '../../realtime/outbox.js';
import {
  AddressEntity,
  CartEntity,
  CartItemEntity,
  CouponEntity,
  CouponUsageEntity,
  DeliveryEntity,
  DeliveryPartnerEntity,
  NotificationEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
  RestaurantEntity,
  UserEntity,
} from '@app/database';
import type { CreateOrderDto } from '../dto/orders.dto.js';
import { OrderPricingService } from './order-pricing.service.js';
import { OrderStateService } from './order-state.service.js';
import { RealtimeGateway } from '../../realtime/realtime.gateway.js';

export interface OrderQuote {
  quoteToken: string; expiresAt: string; subtotal: string; dishSavings: string; discountAmount: string;
  deliveryFee: string; platformFee: string; taxAmount: string; totalAmount: string;
  couponCode: string | null; items: Array<{ id: number; name: string; quantity: number; unitPrice: string; totalPrice: string }>;
}
@Injectable()
export class OrdersService {
  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(RestaurantEntity)
    private readonly restaurants: Repository<RestaurantEntity>,
    @InjectRepository(DeliveryEntity)
    private readonly deliveries: Repository<DeliveryEntity>,
    @InjectRepository(DeliveryPartnerEntity)
    private readonly deliveryPartners: Repository<DeliveryPartnerEntity>,
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
    private readonly pricing: OrderPricingService,
    private readonly states: OrderStateService,
    private readonly realtime: RealtimeGateway,
  ) {}

  listCustomer(customerId: number) {
    return this.orders.find({
      where: { customerId },
      order: { createdAt: 'DESC' },
    });
  }
  async customerGet(customerId: number, id: number) {
    const order = await this.orders.findOne({
      where: { id, customerId },
      relations: { restaurant: true },
    });
    if (!order) throw new NotFoundException(ErrorCode.ORDER_NOT_FOUND);
    const delivery = await this.deliveries.createQueryBuilder('delivery').addSelect('delivery.otpCiphertext')
      .leftJoinAndSelect('delivery.deliveryPartner', 'partner').leftJoinAndSelect('partner.user', 'partnerUser')
      .where('delivery.orderId = :id', { id: order.id }).getOne();
    const otp = delivery?.otpCiphertext && delivery.otpExpiresAt && delivery.otpExpiresAt > new Date() && ![DeliveryStatus.DELIVERED, DeliveryStatus.CANCELLED].includes(delivery.status)
      ? openDeliveryOtp(delivery.otpCiphertext, this.config.get<string>('DELIVERY_OTP_SECRET') || this.config.getOrThrow<string>('jwt.accessSecret')) : undefined;
    return {
      ...order,
      items: await this.dataSource.getRepository(OrderItemEntity).findBy({ orderId: order.id }),
      history: await this.dataSource.getRepository(OrderStatusHistoryEntity).find({ where: { orderId: order.id }, order: { createdAt: 'ASC' } }),
      delivery: delivery
        ? {
            id: delivery.id,
            status: delivery.status,
            estimatedMinutes: delivery.estimatedMinutes,
            deliveryPartner: delivery.deliveryPartner
              ? {
                  name: delivery.deliveryPartner.user.name,
                  phone: delivery.deliveryPartner.user.phone,
                  profilePhotoUrl: delivery.deliveryPartner.profilePhotoUrl,
                  vehicleType: delivery.deliveryPartner.vehicleType,
                  vehicleNumber: delivery.deliveryPartner.vehicleNumber,
                }
              : null,
          }
        : null,
      deliveryOtp:
        delivery && delivery.status !== DeliveryStatus.DELIVERED
          ? otp
          : undefined,
    };
  }
  async merchantList(merchantId: number) {
    const orders = await this.orders
      .createQueryBuilder('order')
      .innerJoin(
        RestaurantEntity,
        'restaurant',
        'restaurant.id = order.restaurantId',
      )
      .where('restaurant.merchantId = :merchantId', { merchantId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
    const items = orders.length ? await this.dataSource.getRepository(OrderItemEntity).findBy({ orderId: In(orders.map(order => order.id)) }) : [];
    return orders.map(order => ({ ...order, items: items.filter(item => Number(item.orderId) === Number(order.id)) }));
  }

  async merchantGet(merchantId: number, id: number) {
    const order = await this.orders.createQueryBuilder('o').innerJoinAndSelect('o.restaurant', 'restaurant')
      .where('o.id = :id AND restaurant.merchantId = :merchantId', { id, merchantId }).getOne();
    if (!order) throw new NotFoundException('Order not found');
    return { ...order, items: await this.dataSource.getRepository(OrderItemEntity).findBy({ orderId: id }),
      history: await this.dataSource.getRepository(OrderStatusHistoryEntity).find({ where: { orderId: id }, order: { createdAt: 'ASC' } }) };
  }

  create(customerId: number, dto: CreateOrderDto, requestKey?: string): Promise<OrderEntity>;
  create(customerId: number, dto: CreateOrderDto, requestKey: undefined, quoteOnly: true): Promise<OrderQuote>;
  async create(customerId: number, dto: CreateOrderDto, requestKey?: string, quoteOnly = false): Promise<OrderEntity | OrderQuote> {
    if (dto.paymentMethod === PaymentMethod.ONLINE && this.config.get<string>('ONLINE_PAYMENTS_ENABLED') !== 'true') throw new BadRequestException('Online payments are not enabled. Choose cash on delivery.');
    if (requestKey && !/^[A-Za-z0-9_-]{8,128}$/.test(requestKey)) throw new BadRequestException('Invalid idempotency key');
    if (dto.couponId && dto.couponCode) throw new BadRequestException('Choose one offer');
    const couponCode = dto.couponCode?.trim().toUpperCase() || undefined;
    const requestTerms = [dto.cartId, dto.addressId, dto.paymentMethod, dto.couponId ?? null, dto.customerNote ?? null];
    if (couponCode) requestTerms.push(couponCode);
    const requestHash = createHash('sha256').update(JSON.stringify(requestTerms)).digest('hex');
    const order = await this.dataSource.transaction(async (manager) => {
      await manager.findOneOrFail(UserEntity, { where: { id: customerId }, lock: { mode: 'pessimistic_write' } });
      if (requestKey) {
        const previous = await manager.getRepository(OrderEntity).createQueryBuilder('o').addSelect('o.requestHash').where('o.customerId = :customerId AND o.requestKey = :requestKey', { customerId, requestKey }).getOne();
        if (previous) {
          if (previous.requestHash !== requestHash) throw new ConflictException('Idempotency key was used for a different order');
          delete (previous as Partial<OrderEntity>).requestHash; return previous;
        }
      }
      const cart = await manager.findOne(CartEntity, {
        where: { id: dto.cartId, userId: customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cart)
        throw new DomainException(
          ErrorCode.CART_EMPTY,
          'Cart not found or empty',
        );
      const restaurant = await manager.findOne(RestaurantEntity, {
        where: { id: cart.restaurantId }, lock: { mode: 'pessimistic_write' },
      });
      if (!restaurant)
        throw new NotFoundException(ErrorCode.RESTAURANT_NOT_FOUND);
      if (restaurant.approvalStatus !== RestaurantApprovalStatus.APPROVED)
        throw new DomainException(
          ErrorCode.RESTAURANT_NOT_APPROVED,
          'Restaurant is not approved',
        );
      if (
        !restaurantAvailability(restaurant).isAcceptingOrders
      )
        throw new DomainException(
          ErrorCode.RESTAURANT_CLOSED,
          'Restaurant is closed',
        );
      const address = await manager.findOne(AddressEntity, { where: {
        id: dto.addressId,
        userId: customerId,
      }, lock: { mode: 'pessimistic_write' } });
      if (!address) throw new NotFoundException('Address not found');
      const distance = haversineDistanceKm(
        {
          latitude: Number(restaurant.latitude),
          longitude: Number(restaurant.longitude),
        },
        {
          latitude: Number(address.latitude),
          longitude: Number(address.longitude),
        },
      );
      if (!Number.isFinite(distance) || distance > Number(restaurant.deliveryRadiusKm))
        throw new DomainException(
          ErrorCode.DELIVERY_LOCATION_OUT_OF_RANGE,
          'Address is outside the restaurant delivery radius',
        );
      const cartItems = await manager.find(CartItemEntity, {
        where: { cartId: cart.id },
        relations: { menuItem: true },
        order: { id: 'ASC' },
      });
      if (!cartItems.length)
        throw new DomainException(ErrorCode.CART_EMPTY, 'Cart is empty');
      for (const item of cartItems)
        if (
          !item.menuItem || !menuAvailability(item.menuItem, restaurant).isOrderable ||
          Number(item.menuItem.restaurantId) !== Number(restaurant.id)
        )
          throw new DomainException(
            ErrorCode.MENU_ITEM_UNAVAILABLE,
            'One or more menu items are unavailable',
          );
      const coupon = dto.couponId || couponCode
        ? await manager.findOne(CouponEntity, { where: {
            ...(dto.couponId ? { id: dto.couponId } : { code: couponCode! }),
            isActive: true,
            startAt: LessThanOrEqual(new Date()),
            expiresAt: MoreThan(new Date()),
          }, lock: { mode: 'pessimistic_write' } })
        : null;
      if ((dto.couponId || couponCode) && !coupon)
        throw new DomainException(
          ErrorCode.COUPON_EXPIRED,
          'Coupon is invalid or expired',
        );
      if (coupon?.restaurantId && Number(coupon.restaurantId) !== Number(restaurant.id)) throw new BadRequestException('This offer belongs to another restaurant');
      if (coupon) await this.validateCouponUsage(manager, coupon, customerId);
      const price = this.pricing.calculate(
        cartItems.map((item) => ({
          menuItem: item.menuItem,
          quantity: item.quantity,
        })),
        coupon,
      );
      if (price.subtotal.isLessThan(Money.fromDecimal(restaurant.minimumOrderAmount))) throw new BadRequestException('Restaurant minimum order amount has not been met');
      const items = price.items.map(item => ({ id: item.menuItem.id, name: item.menuItem.name, quantity: item.quantity, unitPrice: item.unitPrice.toDecimal(), totalPrice: item.total.toDecimal() }));
      const dishSavings = price.items.reduce((sum, item) => sum.add(Money.fromDecimal(item.menuItem.price).subtract(item.unitPrice).multiply(item.quantity)), Money.fromDecimal(0)).toDecimal();
      const summary = { subtotal: price.subtotal.toDecimal(), dishSavings, discountAmount: price.discount.toDecimal(), deliveryFee: price.deliveryFee.toDecimal(), platformFee: price.platformFee.toDecimal(), taxAmount: price.tax.toDecimal(), totalAmount: price.total.toDecimal(), couponCode: coupon?.code ?? null, items };
      const expires = quoteOnly ? Date.now() + 300000 : Number(dto.quoteToken?.split('.')[0]);
      const terms = JSON.stringify({ customerId, cartId: cart.id, address: [address.id, address.addressLine1, address.city, address.postalCode, address.latitude, address.longitude], paymentMethod: dto.paymentMethod, minimumOrderAmount: restaurant.minimumOrderAmount, couponVersion: coupon?.version ?? null, ...summary });
      const signature = createHmac('sha256', this.config.getOrThrow<string>('jwt.accessSecret')).update(`${expires}:${terms}`).digest('hex');
      if (quoteOnly) return { ...summary, quoteToken: `${expires}.${signature}`, expiresAt: new Date(expires).toISOString() };
      if (dto.quoteToken) {
        const supplied = dto.quoteToken.split('.')[1] ?? '';
        if (!/^\d{13}\.[a-f0-9]{64}$/.test(dto.quoteToken) || expires <= Date.now() || expires > Date.now() + 300000 || !timingSafeEqual(Buffer.from(signature), Buffer.from(supplied))) throw new ConflictException('Prices or offer terms changed, or your quote expired. Refresh the total and confirm again.');
      }
      const order = await manager.save(
        OrderEntity,
        manager.create(OrderEntity, {
          uuid: randomUUID(),
          requestKey: requestKey ?? null,
          requestHash: requestKey ? requestHash : null,
          orderNumber: this.orderNumber(),
          customerId,
          restaurantId: restaurant.id,
          addressId: address.id,
          addressSnapshot: { addressLine1: address.addressLine1, addressLine2: address.addressLine2, city: address.city, state: address.state, postalCode: address.postalCode, latitude: address.latitude, longitude: address.longitude },
          couponId: coupon?.id ?? null,
          offerSnapshot: { coupon: coupon ? { id: coupon.id, code: coupon.code, version: coupon.version, restaurantId: coupon.restaurantId, discountType: coupon.discountType, discountValue: coupon.discountValue, minimumOrderAmount: coupon.minimumOrderAmount, maximumDiscount: coupon.maximumDiscount, menuItemIds: coupon.menuItemIds, stackWithDishDiscount: coupon.stackWithDishDiscount, discountAmount: price.discount.toDecimal() } : null, dishSavings, items: price.items.map(item => ({ id: item.menuItem.id, basePrice: item.menuItem.price, chargedPrice: item.unitPrice.toDecimal(), quantity: item.quantity })) },
          subtotal: price.subtotal.toDecimal(),
          discountAmount: price.discount.toDecimal(),
          deliveryFee: price.deliveryFee.toDecimal(),
          platformFee: price.platformFee.toDecimal(),
          taxAmount: price.tax.toDecimal(),
          totalAmount: price.total.toDecimal(),
          paymentMethod: dto.paymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          orderStatus: OrderStatus.PENDING,
          customerNote: dto.customerNote ?? null,
        }),
      );
      await manager.save(
        OrderItemEntity,
        price.items.map((item) =>
          manager.create(OrderItemEntity, {
            orderId: order.id,
            menuItemId: item.menuItem.id,
            itemName: item.menuItem.name,
            itemDescription: item.menuItem.description,
            itemImageUrl: item.menuItem.imageUrl,
            unitPrice: item.unitPrice.toDecimal(),
            quantity: item.quantity,
            totalPrice: item.total.toDecimal(),
          }),
        ),
      );
      await manager.save(
        OrderStatusHistoryEntity,
        manager.create(OrderStatusHistoryEntity, {
          orderId: order.id,
          oldStatus: null,
          newStatus: OrderStatus.PENDING,
          changedByUserId: customerId,
          note: null,
        }),
      );
      if (coupon)
        await manager.save(
          CouponUsageEntity,
          manager.create(CouponUsageEntity, {
            couponId: coupon.id,
            userId: customerId,
            orderId: order.id,
            discountAmount: price.discount.toDecimal(),
          }),
        );
      await manager.delete(CartEntity, cart.id);
      await enqueueEvent(manager, 'restaurant', order.restaurantId, SOCKET_EVENT.ORDER_CREATED, { id: order.id });
      delete (order as Partial<OrderEntity>).requestKey;
      delete (order as Partial<OrderEntity>).requestHash;
      return order;
    });
    return order;
  }

  async customerCancel(customerId: number, id: number, reason: string) {
    const order = await this.customerGet(customerId, id);
    if (order.orderStatus !== OrderStatus.PENDING)
      throw new DomainException(
        ErrorCode.ORDER_CANNOT_BE_CANCELLED,
        'Only pending orders can be cancelled by the customer',
      );
    order.cancellationReason = reason;
    return this.states.transition(
      order,
      OrderStatus.CANCELLED,
      customerId,
      reason,
    );
  }
  async merchantTransition(
    merchantId: number,
    id: number,
    status: OrderStatus,
    note?: string,
  ) {
    const order = await this.orders.findOneBy({ id });
    if (!order) throw new NotFoundException(ErrorCode.ORDER_NOT_FOUND);
    const restaurant = await this.restaurants.findOneBy({
      id: order.restaurantId,
    });
    if (!restaurant || Number(restaurant.merchantId) !== Number(merchantId))
      throw new ForbiddenException('Order does not belong to merchant');
    const updated = await this.states.transition(
      order,
      status,
      merchantId,
      note,
      status === OrderStatus.READY ? (manager, order) => this.createDeliveryRequest(order, manager) : undefined,
    );
    const events: Partial<Record<OrderStatus, string>> = {
      [OrderStatus.ACCEPTED]: SOCKET_EVENT.ORDER_ACCEPTED,
      [OrderStatus.REJECTED]: SOCKET_EVENT.ORDER_REJECTED,
      [OrderStatus.PREPARING]: SOCKET_EVENT.ORDER_PREPARING,
      [OrderStatus.READY]: SOCKET_EVENT.ORDER_READY,
      [OrderStatus.OUT_FOR_DELIVERY]: SOCKET_EVENT.ORDER_OUT_FOR_DELIVERY,
      [OrderStatus.DELIVERED]: SOCKET_EVENT.ORDER_DELIVERED,
    };
    const event = events[status];
    if (event) this.realtime.emitToUser(order.customerId, event, updated);
    return updated;
  }

  private async createDeliveryRequest(order: OrderEntity, manager: import('typeorm').EntityManager) {
    if (await manager.exists(DeliveryEntity, { where: { orderId: order.id } })) return;
    const detailed = await manager.findOne(OrderEntity, {
      where: { id: order.id },
      relations: { restaurant: true, address: true },
    });
    if (!detailed) return;
    const dropoff = detailed.addressSnapshot ?? detailed.address;
    const distanceKm = haversineDistanceKm(
      {
        latitude: Number(detailed.restaurant.latitude),
        longitude: Number(detailed.restaurant.longitude),
      },
      {
        latitude: Number(dropoff.latitude),
        longitude: Number(dropoff.longitude),
      },
    );
    const otp = String(randomInt(100000, 1_000_000));
    const delivery = await manager.save(DeliveryEntity,
      manager.create(DeliveryEntity, {
        orderId: order.id,
        deliveryPartnerId: null,
        status: DeliveryStatus.AVAILABLE,
        distanceKm: distanceKm.toFixed(2),
        deliveryFee: order.deliveryFee,
        estimatedMinutes: Math.max(10, Math.ceil((distanceKm / 20) * 60)),
        rejectedPartnerIds: [],
        otpHash: await hash(otp),
        otpCiphertext: sealDeliveryOtp(otp, this.config.get<string>('DELIVERY_OTP_SECRET') || this.config.getOrThrow<string>('jwt.accessSecret')),
        otpExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        otpAttempts: 0,
      }),
    );
    await manager.save(NotificationEntity,
      manager.create(NotificationEntity, {
        userId: order.customerId,
        type: NotificationType.DELIVERY_OTP,
        title: 'Your delivery OTP',
        message: 'Open your order to view the delivery code. Share it only after receiving your food.',
        data: { orderId: order.id, deliveryId: delivery.id },
        isRead: false,
        readAt: null,
      }),
    );
    const onlinePartners = await manager.find(DeliveryPartnerEntity, {
      where: {
        approvalStatus: DeliveryPartnerApprovalStatus.APPROVED,
        isOnline: true,
      },
    });
    for (const partner of onlinePartners)
      await enqueueEvent(manager, 'user',
        partner.userId,
        SOCKET_EVENT.DELIVERY_AVAILABLE,
        { deliveryId: delivery.id, orderId: order.id },
      );
    await enqueueEvent(manager, 'user', order.customerId, SOCKET_EVENT.ORDER_READY, { id: order.id });
    await enqueueEvent(manager, 'admin', null, SOCKET_EVENT.DELIVERY_AVAILABLE, { deliveryId: delivery.id, orderId: order.id });
  }

  private async validateCouponUsage(
    manager: import('typeorm').EntityManager,
    coupon: CouponEntity,
    customerId: number,
  ) {
    const total = await manager.count(CouponUsageEntity, {
      where: { couponId: coupon.id },
    });
    const byUser = await manager.count(CouponUsageEntity, {
      where: { couponId: coupon.id, userId: customerId },
    });
    if (
      (coupon.totalUsageLimit !== null && total >= coupon.totalUsageLimit) ||
      byUser >= coupon.perUserUsageLimit
    )
      throw new DomainException(
        ErrorCode.COUPON_INVALID,
        'Coupon usage limit exceeded',
      );
  }
  private orderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    return `${ORDER_NUMBER_PREFIX}-${date}-${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
  }
}
