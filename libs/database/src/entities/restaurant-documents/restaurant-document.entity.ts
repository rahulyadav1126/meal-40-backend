import {
  DATABASE_TABLE,
  DocumentType,
  VerificationStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { RestaurantEntity } from '../restaurants/restaurant.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.RESTAURANT_DOCUMENTS)
@Index('idx_restaurant_documents_restaurant', ['restaurantId'])
export class RestaurantDocumentEntity extends BaseEntity {
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true })
  restaurantId: number;
  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
  @Column({ name: 'document_type', type: 'enum', enum: DocumentType })
  documentType: DocumentType;
  @Column({
    name: 'document_number',
    type: 'varchar',
    length: 120,
    nullable: true,
  })
  documentNumber: string | null;
  @Column({ name: 'file_url', type: 'varchar', length: 500 }) fileUrl: string;
  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: VerificationStatus,
    default: VerificationStatus.PENDING,
  })
  verificationStatus: VerificationStatus;
  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason: string | null;
  @Column({
    name: 'verified_by',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  verifiedBy: number | null;
  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt: Date | null;
}
