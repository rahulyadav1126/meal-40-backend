import {
  DATABASE_TABLE,
  DEFAULT_COUNTRY,
  RestaurantApprovalStatus,
  RestaurantOpeningStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { SoftDeleteEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.RESTAURANTS)
@Index('idx_restaurants_merchant', ['merchantId'])
@Index('idx_restaurants_approval_active', ['approvalStatus', 'isActive'])
export class RestaurantEntity extends SoftDeleteEntity {
  @Column({ type: 'char', length: 36, unique: true }) uuid: string;
  @Column({ name: 'merchant_id', type: 'bigint', unsigned: true })
  merchantId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'merchant_id' })
  merchant: UserEntity;
  @Column({ type: 'varchar', length: 160 }) name: string;
  @Column({ type: 'varchar', length: 191, unique: true }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ type: 'varchar', length: 20 }) phone: string;
  @Column({ type: 'varchar', length: 191, nullable: true }) email:
    string | null;
  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;
  @Column({
    name: 'cover_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  coverImageUrl: string | null;
  @Column({ name: 'address_line_1', type: 'varchar', length: 255 })
  addressLine1: string;
  @Column({
    name: 'address_line_2',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  addressLine2: string | null;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'varchar', length: 100 }) state: string;
  @Column({ name: 'postal_code', type: 'varchar', length: 20 })
  postalCode: string;
  @Column({ type: 'varchar', length: 2, default: DEFAULT_COUNTRY })
  country: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) latitude: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) longitude: string;
  @Column({
    name: 'delivery_radius_km',
    type: 'decimal',
    precision: 6,
    scale: 2,
  })
  deliveryRadiusKm: string;
  @Column({
    name: 'minimum_order_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  minimumOrderAmount: string;
  @Column({
    name: 'opening_status',
    type: 'enum',
    enum: RestaurantOpeningStatus,
    default: RestaurantOpeningStatus.CLOSED,
  })
  openingStatus: RestaurantOpeningStatus;
  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: RestaurantApprovalStatus,
    default: RestaurantApprovalStatus.PENDING,
  })
  approvalStatus: RestaurantApprovalStatus;
  @Column({
    name: 'average_rating',
    type: 'decimal',
    precision: 3,
    scale: 2,
    default: 0,
  })
  averageRating: string;
  @Column({ name: 'rating_count', type: 'int', unsigned: true, default: 0 })
  ratingCount: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
}
