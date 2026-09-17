import {
  DATABASE_TABLE,
  DiscountType,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.COUPONS)
@Index('idx_coupons_active_dates', ['isActive', 'startAt', 'expiresAt'])
export class CouponEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 50, unique: true }) code: string;
  @Column({ type: 'varchar', length: 500, nullable: true }) description:
    string | null;
  @Column({ name: 'discount_type', type: 'enum', enum: DiscountType })
  discountType: DiscountType;
  @Column({ name: 'discount_value', type: 'decimal', precision: 10, scale: 2 })
  discountValue: string;
  @Column({
    name: 'maximum_discount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  maximumDiscount: string | null;
  @Column({
    name: 'minimum_order_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  minimumOrderAmount: string;
  @Column({ name: 'start_at', type: 'datetime' }) startAt: Date;
  @Column({ name: 'expires_at', type: 'datetime' }) expiresAt: Date;
  @Column({
    name: 'total_usage_limit',
    type: 'int',
    unsigned: true,
    nullable: true,
  })
  totalUsageLimit: number | null;
  @Column({
    name: 'per_user_usage_limit',
    type: 'int',
    unsigned: true,
    default: 1,
  })
  perUserUsageLimit: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
}
