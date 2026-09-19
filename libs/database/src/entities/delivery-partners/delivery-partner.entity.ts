import {
  DATABASE_TABLE,
  DeliveryPartnerApprovalStatus,
  VehicleType,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, OneToOne } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.DELIVERY_PARTNERS)
@Index('uq_delivery_partners_user', ['userId'], { unique: true })
@Index('idx_delivery_partners_dispatch', ['approvalStatus', 'isOnline'])
export class DeliveryPartnerEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'bigint', unsigned: true }) userId: number;
  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @Column({
    name: 'profile_photo_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  profilePhotoUrl: string | null;
  @Column({ type: 'varchar', length: 500 }) address: string;
  @Column({ name: 'vehicle_type', type: 'enum', enum: VehicleType })
  vehicleType: VehicleType;
  @Column({ name: 'vehicle_number', type: 'varchar', length: 30 })
  vehicleNumber: string;
  @Column({
    name: 'approval_status',
    type: 'enum',
    enum: DeliveryPartnerApprovalStatus,
    default: DeliveryPartnerApprovalStatus.PENDING,
  })
  approvalStatus: DeliveryPartnerApprovalStatus;
  @Column({ name: 'is_online', type: 'boolean', default: false })
  isOnline: boolean;
  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date | null;
}
