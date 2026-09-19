import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { DeliveryPartnerEntity } from '../delivery-partners/delivery-partner.entity.js';
import { DeliveryEntity } from '../deliveries/delivery.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.DELIVERY_EARNINGS)
@Index('uq_delivery_earnings_delivery', ['deliveryId'], { unique: true })
@Index('idx_delivery_earnings_partner_created', [
  'deliveryPartnerId',
  'createdAt',
])
export class DeliveryEarningEntity extends BaseEntity {
  @Column({ name: 'delivery_id', type: 'bigint', unsigned: true })
  deliveryId: number;
  @OneToOne(() => DeliveryEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_id' })
  delivery: DeliveryEntity;
  @Column({ name: 'delivery_partner_id', type: 'bigint', unsigned: true })
  deliveryPartnerId: number;
  @ManyToOne(() => DeliveryPartnerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_partner_id' })
  deliveryPartner: DeliveryPartnerEntity;
  @Column({ name: 'base_amount', type: 'decimal', precision: 10, scale: 2 })
  baseAmount: string;
  @Column({ name: 'distance_amount', type: 'decimal', precision: 10, scale: 2 })
  distanceAmount: string;
  @Column({
    name: 'tip_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  tipAmount: string;
  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: string;
}
