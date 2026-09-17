import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.AUTH_SESSIONS)
@Index('idx_sessions_user_revoked', ['userId', 'revokedAt'])
export class AuthSessionEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'bigint', unsigned: true }) userId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @Column({
    name: 'refresh_token_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  refreshTokenHash: string;
  @Column({ name: 'device_name', type: 'varchar', length: 120, nullable: true })
  deviceName: string | null;
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;
  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent: string | null;
  @Column({ name: 'expires_at', type: 'datetime' }) expiresAt: Date;
  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt: Date | null;
}
