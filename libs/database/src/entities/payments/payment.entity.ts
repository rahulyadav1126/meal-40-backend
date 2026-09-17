import {
  DATABASE_TABLE,
  DEFAULT_CURRENCY,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OrderEntity } from '../orders/order.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.PAYMENTS)
@Index('idx_payments_order', ['orderId'])
@Index('idx_payments_provider_order', ['providerOrderId'])
export class PaymentEntity extends BaseEntity {
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId: number;
  @ManyToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  @Column({ type: 'enum', enum: PaymentProvider }) provider: PaymentProvider;
  @Column({
    name: 'provider_order_id',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  providerOrderId: string | null;
  @Column({
    name: 'provider_payment_id',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  providerPaymentId: string | null;
  @Column({
    name: 'provider_signature',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  providerSignature: string | null;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) amount: string;
  @Column({ type: 'varchar', length: 3, default: DEFAULT_CURRENCY })
  currency: string;
  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;
  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;
  @Column({ name: 'paid_at', type: 'datetime', nullable: true })
  paidAt: Date | null;
  @Column({ name: 'failed_at', type: 'datetime', nullable: true })
  failedAt: Date | null;
}
