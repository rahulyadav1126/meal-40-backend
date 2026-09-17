import { DATABASE_TABLE, JobStatus } from '../../../../contracts/src/index.js';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.BACKGROUND_JOBS)
@Index('idx_jobs_status_available', ['status', 'availableAt'])
export class BackgroundJobEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 120 }) type: string;
  @Column({ name: 'payload_json', type: 'json' }) payload: Record<
    string,
    unknown
  >;
  @Column({ type: 'enum', enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus;
  @Column({ type: 'smallint', unsigned: true, default: 0 }) attempts: number;
  @Column({
    name: 'max_attempts',
    type: 'smallint',
    unsigned: true,
    default: 3,
  })
  maxAttempts: number;
  @Column({ name: 'available_at', type: 'datetime' }) availableAt: Date;
  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date | null;
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;
  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failedAt: Date | null;
  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;
}
