import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CouponEntity } from '../coupons/coupon.entity.js';
import { OrderEntity } from '../orders/order.entity.js';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.COUPON_USAGES)
@Unique('uq_coupon_order', ['couponId', 'orderId'])
export class CouponUsageEntity extends BaseEntity {
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true })
  couponId: number;
  @ManyToOne(() => CouponEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: CouponEntity;
  @Column({ name: 'user_id', type: 'bigint', unsigned: true }) userId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId: number;
  @ManyToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  @Column({ name: 'discount_amount', type: 'decimal', precision: 10, scale: 2 })
  discountAmount: string;
}
