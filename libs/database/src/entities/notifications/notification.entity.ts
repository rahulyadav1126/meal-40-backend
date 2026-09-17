import {
  DATABASE_TABLE,
  NotificationType,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.NOTIFICATIONS)
@Index('idx_notifications_user_read', ['userId', 'isRead'])
export class NotificationEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'bigint', unsigned: true }) userId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @Column({ type: 'enum', enum: NotificationType }) type: NotificationType;
  @Column({ type: 'varchar', length: 160 }) title: string;
  @Column({ type: 'text' }) message: string;
  @Column({ name: 'data_json', type: 'json', nullable: true }) data: Record<
    string,
    unknown
  > | null;
  @Column({ name: 'is_read', default: false }) isRead: boolean;
  @Column({ name: 'read_at', type: 'datetime', nullable: true })
  readAt: Date | null;
}
