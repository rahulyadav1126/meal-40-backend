import {
  AuditAction,
  AuditEntityType,
  DATABASE_TABLE,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.AUDIT_LOGS)
@Index('idx_audit_entity', ['entityType', 'entityId'])
export class AuditLogEntity extends BaseEntity {
  @Column({
    name: 'actor_user_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  actorUserId: number | null;
  @Column({ type: 'enum', enum: AuditAction }) action: AuditAction;
  @Column({ name: 'entity_type', type: 'enum', enum: AuditEntityType })
  entityType: AuditEntityType;
  @Column({ name: 'entity_id', type: 'varchar', length: 120 }) entityId: string;
  @Column({ name: 'old_values_json', type: 'json', nullable: true })
  oldValues: Record<string, unknown> | null;
  @Column({ name: 'new_values_json', type: 'json', nullable: true })
  newValues: Record<string, unknown> | null;
  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;
}
