import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { OrderEntity } from '../orders/order.entity.js';
import { RestaurantEntity } from '../restaurants/restaurant.entity.js';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.REVIEWS)
@Unique('uq_reviews_order', ['orderId'])
export class ReviewEntity extends BaseEntity {
  @Column({ name: 'customer_id', type: 'bigint', unsigned: true })
  customerId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: UserEntity;
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true })
  restaurantId: number;
  @ManyToOne(() => RestaurantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
  @Column({ name: 'order_id', type: 'bigint', unsigned: true }) orderId: number;
  @ManyToOne(() => OrderEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: OrderEntity;
  @Column({ type: 'tinyint', unsigned: true }) rating: number;
  @Column({ type: 'text', nullable: true }) comment: string | null;
  @Column({ name: 'is_visible', default: true }) isVisible: boolean;
}
