import {
  DATABASE_TABLE,
  OrderStatus,
} from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { OrderEntity } from '../orders/order.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.ORDER_STATUS_HISTORY)
@Index('idx_order_history_order', ['orderId', 'createdAt'])
export class OrderStatusHistoryEntity extends BaseEntity {
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId: number;
  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  @Column({
    name: 'old_status',
    type: 'enum',
    enum: OrderStatus,
    nullable: true,
  })
  oldStatus: OrderStatus | null;
  @Column({ name: 'new_status', type: 'enum', enum: OrderStatus })
  newStatus: OrderStatus;
  @Column({
    name: 'changed_by_user_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  changedByUserId: number | null;
  @Column({ type: 'varchar', length: 500, nullable: true }) note: string | null;
}
