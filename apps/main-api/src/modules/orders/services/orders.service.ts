import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, randomUUID } from 'node:crypto';
import { hash } from 'argon2';
import {
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
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
  RestaurantApprovalStatus,
  RestaurantOpeningStatus,
  SOCKET_EVENT,
} from '@app/contracts';
import { DomainException, haversineDistanceKm } from '@app/common';
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
} from '@app/database';
import type { CreateOrderDto } from '../dto/orders.dto.js';
import { OrderPricingService } from './order-pricing.service.js';
import { OrderStateService } from './order-state.service.js';
import { RealtimeGateway } from '../../realtime/realtime.gateway.js';

@Injectable()
export class OrdersService {
  constructor(
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
    const delivery = await this.deliveries.findOne({
      where: { orderId: order.id },
      relations: { deliveryPartner: { user: true } },
    });
    const otpNotifications = await this.notifications.find({
      where: { userId: customerId, type: NotificationType.DELIVERY_OTP },
      order: { createdAt: 'DESC' },
      take: 20,
    });
    const otp = otpNotifications.find(
      (notification) => Number(notification.data?.orderId) === Number(order.id),
    )?.data?.otp;
    return {
      ...order,
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
    return this.orders
      .createQueryBuilder('order')
      .innerJoin(
        RestaurantEntity,
        'restaurant',
        'restaurant.id = order.restaurantId',
      )
      .where('restaurant.merchantId = :merchantId', { merchantId })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
  }

  async create(customerId: number, dto: CreateOrderDto): Promise<OrderEntity> {
    const order = await this.dataSource.transaction(async (manager) => {
      const cart = await manager.findOne(CartEntity, {
        where: { id: dto.cartId, userId: customerId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cart)
        throw new DomainException(
          ErrorCode.CART_EMPTY,
          'Cart not found or empty',
        );
      const restaurant = await manager.findOneBy(RestaurantEntity, {
        id: cart.restaurantId,
      });
      if (!restaurant)
        throw new NotFoundException(ErrorCode.RESTAURANT_NOT_FOUND);
      if (restaurant.approvalStatus !== RestaurantApprovalStatus.APPROVED)
        throw new DomainException(
          ErrorCode.RESTAURANT_NOT_APPROVED,
          'Restaurant is not approved',
        );
      if (
        restaurant.openingStatus !== RestaurantOpeningStatus.OPEN ||
        !restaurant.isActive
      )
        throw new DomainException(
          ErrorCode.RESTAURANT_CLOSED,
          'Restaurant is closed',
        );
      const address = await manager.findOneBy(AddressEntity, {
        id: dto.addressId,
        userId: customerId,
      });
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
      console.log(distance);
      if (distance > 3000)
        throw new DomainException(
          ErrorCode.DELIVERY_LOCATION_OUT_OF_RANGE,
          'Address is outside the restaurant delivery radius',
        );
      const cartItems = await manager.find(CartItemEntity, {
        where: { cartId: cart.id },
        relations: { menuItem: true },
      });
      if (!cartItems.length)
        throw new DomainException(ErrorCode.CART_EMPTY, 'Cart is empty');
      for (const item of cartItems)
        if (
          !item.menuItem.isAvailable ||
          item.menuItem.restaurantId !== restaurant.id
        )
          throw new DomainException(
            ErrorCode.MENU_ITEM_UNAVAILABLE,
            'One or more menu items are unavailable',
          );
      const coupon = dto.couponId
        ? await manager.findOneBy(CouponEntity, {
            id: dto.couponId,
            isActive: true,
            startAt: LessThanOrEqual(new Date()),
            expiresAt: MoreThanOrEqual(new Date()),
          })
        : null;
      if (dto.couponId && !coupon)
        throw new DomainException(
          ErrorCode.COUPON_EXPIRED,
          'Coupon is invalid or expired',
        );
      if (coupon) await this.validateCouponUsage(manager, coupon, customerId);
      const price = this.pricing.calculate(
        cartItems.map((item) => ({
          menuItem: item.menuItem,
          quantity: item.quantity,
        })),
        coupon,
      );
      const order = await manager.save(
        OrderEntity,
        manager.create(OrderEntity, {
          uuid: randomUUID(),
          orderNumber: this.orderNumber(),
          customerId,
          restaurantId: restaurant.id,
          addressId: address.id,
          couponId: coupon?.id ?? null,
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
      return order;
    });
    this.realtime.emitToRestaurant(
      order.restaurantId,
      SOCKET_EVENT.ORDER_CREATED,
      order,
    );
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
    if (!restaurant || restaurant.merchantId !== merchantId)
      throw new ForbiddenException('Order does not belong to merchant');
    const updated = await this.states.transition(
      order,
      status,
      merchantId,
      note,
    );
    if (status === OrderStatus.READY) await this.createDeliveryRequest(updated);
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

  private async createDeliveryRequest(order: OrderEntity) {
    if (await this.deliveries.exists({ where: { orderId: order.id } })) return;
    const detailed = await this.orders.findOne({
      where: { id: order.id },
      relations: { restaurant: true, address: true },
    });
    if (!detailed) return;
    const distanceKm = haversineDistanceKm(
      {
        latitude: Number(detailed.restaurant.latitude),
        longitude: Number(detailed.restaurant.longitude),
      },
      {
        latitude: Number(detailed.address.latitude),
        longitude: Number(detailed.address.longitude),
      },
    );
    const otp = String(randomInt(100000, 1_000_000));
    const delivery = await this.deliveries.save(
      this.deliveries.create({
        orderId: order.id,
        deliveryPartnerId: null,
        status: DeliveryStatus.AVAILABLE,
        distanceKm: distanceKm.toFixed(2),
        deliveryFee: order.deliveryFee,
        estimatedMinutes: Math.max(10, Math.ceil((distanceKm / 20) * 60)),
        rejectedPartnerIds: [],
        otpHash: await hash(otp),
        otpExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        otpAttempts: 0,
      }),
    );
    await this.notifications.save(
      this.notifications.create({
        userId: order.customerId,
        type: NotificationType.DELIVERY_OTP,
        title: 'Your delivery OTP',
        message: `Share OTP ${otp} with your delivery partner only after receiving your order.`,
        data: { orderId: order.id, deliveryId: delivery.id, otp },
        isRead: false,
        readAt: null,
      }),
    );
    const onlinePartners = await this.deliveryPartners.find({
      where: {
        approvalStatus: DeliveryPartnerApprovalStatus.APPROVED,
        isOnline: true,
      },
    });
    for (const partner of onlinePartners)
      this.realtime.emitToUser(
        partner.userId,
        SOCKET_EVENT.DELIVERY_AVAILABLE,
        { deliveryId: delivery.id, orderId: order.id },
      );
    this.realtime.emitToUser(order.customerId, SOCKET_EVENT.ORDER_READY, {
      order,
      deliveryOtp: otp,
    });
    this.realtime.emitToAdmin(SOCKET_EVENT.DELIVERY_AVAILABLE, delivery);
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
