import {
  AddressLabel,
  DATABASE_TABLE,
  DEFAULT_COUNTRY,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.ADDRESSES)
@Index('idx_addresses_user', ['userId'])
export class AddressEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'bigint', unsigned: true }) userId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @Column({ type: 'enum', enum: AddressLabel, default: AddressLabel.HOME })
  label: AddressLabel;
  @Column({ name: 'recipient_name', type: 'varchar', length: 120 })
  recipientName: string;
  @Column({ type: 'varchar', length: 20 }) phone: string;
  @Column({ name: 'address_line_1', type: 'varchar', length: 255 })
  addressLine1: string;
  @Column({
    name: 'address_line_2',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  addressLine2: string | null;
  @Column({ type: 'varchar', length: 120, nullable: true }) landmark:
    string | null;
  @Column({ type: 'varchar', length: 100 }) city: string;
  @Column({ type: 'varchar', length: 100 }) state: string;
  @Column({ name: 'postal_code', type: 'varchar', length: 20 })
  postalCode: string;
  @Column({ type: 'varchar', length: 2, default: DEFAULT_COUNTRY })
  country: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) latitude: string;
  @Column({ type: 'decimal', precision: 10, scale: 7 }) longitude: string;
  @Column({ name: 'is_default', default: false }) isDefault: boolean;
}
