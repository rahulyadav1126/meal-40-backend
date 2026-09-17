import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, randomUUID } from 'node:crypto';
import {
  DataSource,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import {
  ErrorCode,
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
    return order;
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
      if (distance > Number(restaurant.deliveryRadiusKm))
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
