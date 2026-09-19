import {
  DATABASE_TABLE,
  DeliveryDocumentType,
  VerificationStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';
import { DeliveryPartnerEntity } from '../delivery-partners/delivery-partner.entity.js';

@Entity(DATABASE_TABLE.DELIVERY_PARTNER_DOCUMENTS)
@Index('idx_delivery_documents_partner', ['deliveryPartnerId'])
export class DeliveryPartnerDocumentEntity extends BaseEntity {
  @Column({ name: 'delivery_partner_id', type: 'bigint', unsigned: true })
  deliveryPartnerId: number;
  @ManyToOne(() => DeliveryPartnerEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'delivery_partner_id' })
  deliveryPartner: DeliveryPartnerEntity;
  @Column({ type: 'enum', enum: DeliveryDocumentType })
  type: DeliveryDocumentType;
  @Column({ name: 'document_number', type: 'varchar', length: 100 })
  documentNumber: string;
  @Column({
    name: 'document_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  documentUrl: string | null;
  @Column({
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  status: VerificationStatus;
  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt: Date | null;
}
