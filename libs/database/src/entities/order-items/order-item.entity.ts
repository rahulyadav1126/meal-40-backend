import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { MenuItemEntity } from '../menu-items/menu-item.entity.js';
import { OrderEntity } from '../orders/order.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.ORDER_ITEMS)
@Index('idx_order_items_order', ['orderId'])
export class OrderItemEntity extends BaseEntity {
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId: number;
  @ManyToOne(() => OrderEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  @Column({
    name: 'menu_item_id',
    type: 'bigint',
    unsigned: true,
    nullable: true,
  })
  menuItemId: number | null;
  @ManyToOne(() => MenuItemEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItemEntity | null;
  @Column({ name: 'item_name', type: 'varchar', length: 160 }) itemName: string;
  @Column({ name: 'item_description', type: 'text', nullable: true })
  itemDescription: string | null;
  @Column({
    name: 'item_image_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  itemImageUrl: string | null;
  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: string;
  @Column({ type: 'smallint', unsigned: true }) quantity: number;
  @Column({ name: 'total_price', type: 'decimal', precision: 10, scale: 2 })
  totalPrice: string;
}
