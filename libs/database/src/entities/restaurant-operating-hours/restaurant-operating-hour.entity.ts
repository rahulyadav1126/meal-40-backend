import { DATABASE_TABLE, DayOfWeek } from '../../../../contracts/src/index.js';
import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { RestaurantEntity } from '../restaurants/restaurant.entity.js';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.RESTAURANT_OPERATING_HOURS)
@Unique('uq_restaurant_day', ['restaurantId', 'dayOfWeek'])
export class RestaurantOperatingHourEntity extends BaseEntity {
  @Column({ name: 'restaurant_id', type: 'bigint', unsigned: true })
  restaurantId: number;
  @ManyToOne(() => RestaurantEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'restaurant_id' })
  restaurant: RestaurantEntity;
  @Column({ name: 'day_of_week', type: 'enum', enum: DayOfWeek })
  dayOfWeek: DayOfWeek;
  @Column({ name: 'opening_time', type: 'time', nullable: true }) openingTime:
    string | null;
  @Column({ name: 'closing_time', type: 'time', nullable: true }) closingTime:
    string | null;
  @Column({ name: 'is_closed', default: false }) isClosed: boolean;
}
