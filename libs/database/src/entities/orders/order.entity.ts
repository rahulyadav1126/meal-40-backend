import {
  DATABASE_TABLE,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AddressEntity } from '../addresses/address.entity.js';
import { CouponEntity } from '../coupons/coupon.entity.js';
import { RestaurantEntity } from '../restaurants/restaurant.entity.js';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.ORDERS)
@Index('idx_orders_customer_created', ['customerId', 'createdAt'])
@Index('idx_orders_restaurant_status', ['restaurantId', 'orderStatus'])
@Index('uq_orders_customer_request', ['customerId', 'requestKey'], { unique: true })
export class OrderEntity extends BaseEntity {
  @Column({ name: 'offer_snapshot', type: 'json', nullable: true }) offerSnapshot: Record<string, unknown> | null;
  @Column({ name: 'address_snapshot', type: 'json', nullable: true })
  addressSnapshot: Pick<AddressEntity, 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'postalCode' | 'latitude' | 'longitude'> | null;
  @Column({ name: 'request_key', type: 'varchar', length: 128, nullable: true, select: false }) requestKey: string | null;
  @Column({ name: 'request_hash', type: 'char', length: 64, nullable: true, select: false }) requestHash: string | null;
  @Column({ type: 'char', length: 36, unique: true }) uuid: string;
  @Column({ name: 'order_number', type: 'varchar', length: 40, unique: true })
  orderNumber: string;
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: UserEntity;
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true })
  restaurantId: number;
  @ManyToOne(() => RestaurantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
  @Column({ name: 'address_id', type: 'bigint', unsigned: true })
  addressId: number;
  @ManyToOne(() => AddressEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'address_id' })
  address: AddressEntity;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true, nullable: true })
  couponId: number | null;
  @ManyToOne(() => CouponEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity | null;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) subtotal: string;
  @Column({
    name: 'discount_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  discountAmount: string;
  @Column({
    name: 'delivery_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  deliveryFee: string;
  @Column({
    name: 'platform_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  platformFee: string;
  @Column({
    name: 'tax_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  taxAmount: string;
  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: string;
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;
  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  paymentStatus: PaymentStatus;
  @Column({
    name: 'order_status',
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  orderStatus: OrderStatus;
  @Column({
    name: 'customer_note',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  customerNote: string | null;
  @Column({
    name: 'cancellation_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancellationReason: string | null;
  @Column({ name: 'accepted_at', type: 'datetime', nullable: true })
  acceptedAt: Date | null;
  @Column({ name: 'preparing_at', type: 'datetime', nullable: true })
  preparingAt: Date | null;
  @Column({ name: 'ready_at', type: 'datetime', nullable: true })
  readyAt: Date | null;
  @Column({ name: 'out_for_delivery_at', type: 'datetime', nullable: true })
  outForDeliveryAt: Date | null;
  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date | null;
  @Column({ name: 'cancelled_at', type: 'datetime', nullable: true })
  cancelledAt: Date | null;
}
