import { DATABASE_TABLE, FoodType } from '../../../../contracts/src/index.js';
import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { CategoryEntity } from '../categories/category.entity.js';
import { RestaurantEntity } from '../restaurants/restaurant.entity.js';
import { SoftDeleteEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.MENU_ITEMS)
@Index('idx_menu_restaurant_available', ['restaurantId', 'isAvailable'])
@Index('idx_menu_category', ['categoryId'])
@Unique('uq_menu_restaurant_slug', ['restaurantId', 'slug'])
export class MenuItemEntity extends SoftDeleteEntity {
  @Column({ type: 'char', length: 36, unique: true }) uuid: string;
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true })
  restaurantId: number;
  @ManyToOne(() => RestaurantEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
  @Column({ name: 'category_id', type: 'bigint', unsigned: true })
  categoryId: number;
  @ManyToOne(() => CategoryEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;
  @Column({ type: 'varchar', length: 160 }) name: string;
  @Column({ type: 'varchar', length: 191 }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;
  @Column({ name: 'food_type', type: 'enum', enum: FoodType })
  foodType: FoodType;
  @Column({ type: 'decimal', precision: 10, scale: 2 }) price: string;
  @Column({
    name: 'discounted_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  discountedPrice: string | null;
  @Column({ name: 'is_available', default: true }) isAvailable: boolean;
  @Column({ name: 'is_featured', default: false }) isFeatured: boolean;
  @Column({
    name: 'preparation_time_minutes',
    type: 'smallint',
    unsigned: true,
  })
  preparationTimeMinutes: number;
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
}
