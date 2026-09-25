import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { DATABASE_TABLE } from '../../../../contracts/src/index.js';

// These append-only tables are used by transactional raw inserts. Keep them in
// entity metadata so a fresh generated baseline also includes them.
@Entity(DATABASE_TABLE.RESTAURANT_AVAILABILITY_AUDIT)
@Index('idx_availability_audit', ['restaurantId', 'createdAt'])
export class RestaurantAvailabilityAuditEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id: number;
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true }) restaurantId: number;
  @Column({ name: 'actor_user_id', type: 'bigint', unsigned: true }) actorUserId: number;
  @Column({ type: 'int', unsigned: true }) version: number;
  @Column({ type: 'json' }) settings: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt: Date;
}

@Entity(DATABASE_TABLE.MERCHANT_OFFER_AUDIT)
@Index('idx_offer_audit', ['couponId', 'createdAt'])
export class MerchantOfferAuditEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true }) id: number;
  @Column({ name: 'coupon_id', type: 'bigint', unsigned: true }) couponId: number;
  @Column({ name: 'actor_user_id', type: 'bigint', unsigned: true }) actorUserId: number;
  @Column({ type: 'int', unsigned: true }) version: number;
  @Column({ type: 'json' }) terms: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 }) createdAt: Date;
}
