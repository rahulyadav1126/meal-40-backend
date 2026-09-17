import {
  DATABASE_TABLE,
  PaymentProvider,
  WebhookStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Unique } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.WEBHOOK_EVENTS)
@Unique('uq_webhook_provider_event', ['provider', 'eventId'])
export class WebhookEventEntity extends BaseEntity {
  @Column({ type: 'enum', enum: PaymentProvider }) provider: PaymentProvider;
  @Column({ name: 'event_id', type: 'varchar', length: 191 }) eventId: string;
  @Column({ name: 'event_type', type: 'varchar', length: 120 })
  eventType: string;
  @Column({ type: 'json' }) payload: Record<string, unknown>;
  @Column({ name: 'processed_at', type: 'datetime', nullable: true })
  processedAt: Date | null;
  @Column({ type: 'enum', enum: WebhookStatus, default: WebhookStatus.PENDING })
  status: WebhookStatus;
}
