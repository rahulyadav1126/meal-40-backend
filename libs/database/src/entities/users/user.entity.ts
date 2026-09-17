import {
  DATABASE_TABLE,
  UserRole,
  UserStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index } from 'typeorm';
import { SoftDeleteEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.USERS)
@Index('uq_users_email', ['email'], { unique: true })
@Index('uq_users_phone', ['phone'], { unique: true })
export class UserEntity extends SoftDeleteEntity {
  @Column({ type: 'char', length: 36, unique: true }) uuid: string;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 191, nullable: true }) email:
    string | null;
  @Column({ type: 'varchar', length: 20, nullable: true }) phone: string | null;
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash: string;
  @Column({ type: 'enum', enum: UserRole, default: UserRole.CUSTOMER })
  role: UserRole;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;
  @Column({ name: 'email_verified_at', type: 'datetime', nullable: true })
  emailVerifiedAt: Date | null;
  @Column({ name: 'phone_verified_at', type: 'datetime', nullable: true })
  phoneVerifiedAt: Date | null;
  @Column({ name: 'last_login_at', type: 'datetime', nullable: true })
  lastLoginAt: Date | null;
}
