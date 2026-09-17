import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { RestaurantEntity } from '../restaurants/restaurant.entity.js';
import { BaseEntity } from '../shared/base.entity.js';
import { UserEntity } from '../users/user.entity.js';

@Entity(DATABASE_TABLE.CARTS)
@Unique('uq_cart_user_restaurant', ['userId', 'restaurantId'])
export class CartEntity extends BaseEntity {
  @Column({ name: 'user_id', type: 'bigint', unsigned: true }) userId: number;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true })
  restaurantId: number;
  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
}
