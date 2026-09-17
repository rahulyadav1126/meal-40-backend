import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CartEntity } from '../carts/cart.entity.js';
import { MenuItemEntity } from '../menu-items/menu-item.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.CART_ITEMS)
@Unique('uq_cart_menu_item', ['cartId', 'menuItemId'])
export class CartItemEntity extends BaseEntity {
  @Column({ name: 'cart_id', type: 'bigint', unsigned: true }) cartId: number;
  @ManyToOne(() => CartEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: CartEntity;
  @Column({ name: 'menu_item_id', type: 'bigint', unsigned: true })
  menuItemId: number;
  @ManyToOne(() => MenuItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItemEntity;
  @Column({ type: 'smallint', unsigned: true }) quantity: number;
}
