import {
  DATABASE_TABLE,
  DeliveryStatus,
} from '../../../../contracts/src/index.js';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { DeliveryPartnerEntity } from '../delivery-partners/delivery-partner.entity.js';
import { OrderEntity } from '../orders/order.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

// Explicit subset: AVAILABLE and terminal states must not reserve a rider.
const activePartnerStatuses: readonly DeliveryStatus[] = [
  DeliveryStatus.ASSIGNED,
  DeliveryStatus.ARRIVED_AT_MERCHANT,
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.OUT_FOR_DELIVERY,
  DeliveryStatus.ARRIVED_AT_CUSTOMER,
];
const activePartnerExpression = `CASE WHEN status IN (${activePartnerStatuses
  .map((status) => `'${status.replace(/'/g, "''")}'`)
  .join(',')}) THEN delivery_partner_id ELSE NULL END`;

@Entity(DATABASE_TABLE.DELIVERIES)
@Index('uq_deliveries_order', ['orderId'], { unique: true })
@Index('idx_deliveries_partner_status', ['deliveryPartnerId', 'status'])
@Index('uq_deliveries_active_partner', ['activePartnerId'], { unique: true })
export class DeliveryEntity extends BaseEntity {
  // TypeORM's MySQL generator places UNSIGNED after AS (...) STORED, which is
  // invalid SQL. DECIMAL(20,0) retains the full unsigned BIGINT ID range without
  // that modifier. This is only an index helper, not the rider foreign key.
  @Column({
    name: 'active_partner_id',
    type: 'decimal',
    precision: 20,
    scale: 0,
    nullable: true,
    select: false,
    insert: false,
    update: false,
    generatedType: 'STORED',
    asExpression: activePartnerExpression,
  })
  activePartnerId: string | null;
  @Column({ name: 'last_location', type: 'json', nullable: true, select: false })
  lastLocation: { latitude: number; longitude: number; accuracy: number; heading?: number; recordedAt: string; receivedAt: string } | null;
  @Column({ name: 'otp_ciphertext', type: 'text', nullable: true, select: false }) otpCiphertext: string | null;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId: number;
  @OneToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  @Column({
    name: 'delivery_partner_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  deliveryPartnerId: number | null;
  // MySQL forbids SET NULL/CASCADE on a base column used by a STORED
  // generated column (active_partner_id). Preserve rider history instead.
  @ManyToOne(() => DeliveryPartnerEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'RESTRICT',
    nullable: true,
  })
  @JoinColumn({ name: 'delivery_partner_id' })
  deliveryPartner: DeliveryPartnerEntity | null;
  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.AVAILABLE,
  })
  status: DeliveryStatus;
  @Column({ name: 'distance_km', type: 'decimal', precision: 8, scale: 2 })
  distanceKm: string;
  @Column({ name: 'delivery_fee', type: 'decimal', precision: 10, scale: 2 })
  deliveryFee: string;
  @Column({ name: 'estimated_minutes', type: 'int', unsigned: true })
  estimatedMinutes: number;
  @Column({ name: 'rejected_partner_ids', type: 'json', nullable: true })
  rejectedPartnerIds: number[] | null;
  @Column({
    name: 'otp_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  otpHash: string | null;
  @Column({ name: 'otp_expires_at', type: 'datetime', nullable: true })
  otpExpiresAt: Date | null;
  @Column({ name: 'otp_attempts', type: 'int', unsigned: true, default: 0 })
  otpAttempts: number;
  @Column({ name: 'assigned_at', type: 'datetime', nullable: true })
  assignedAt: Date | null;
  @Column({ name: 'arrived_merchant_at', type: 'datetime', nullable: true })
  arrivedMerchantAt: Date | null;
  @Column({ name: 'picked_up_at', type: 'datetime', nullable: true })
  pickedUpAt: Date | null;
  @Column({ name: 'out_for_delivery_at', type: 'datetime', nullable: true })
  outForDeliveryAt: Date | null;
  @Column({ name: 'arrived_customer_at', type: 'datetime', nullable: true })
  arrivedCustomerAt: Date | null;
  @Column({ name: 'delivered_at', type: 'datetime', nullable: true })
  deliveredAt: Date | null;
}
