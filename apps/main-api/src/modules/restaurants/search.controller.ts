import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, Max, Min } from 'class-validator';
import { Public } from '@app/auth';
import { FoodType, RestaurantApprovalStatus } from '@app/contracts';
import { PaginationDto, haversineDistanceKm, menuAvailability, restaurantAvailability, menuPrice } from '@app/common';
import { MenuItemEntity, RestaurantEntity } from '@app/database';

class SearchDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(100) q?: string;
  @IsOptional() @IsEnum(FoodType) foodType?: FoodType;
  @IsOptional() @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value) @IsBoolean() openNow?: boolean;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsNumber() @Min(0) @Max(5) minimumRating?: number;
}

@Public()
@Controller('search')
export class SearchController {
  constructor(private readonly db: DataSource) {}
  @Get()
  async search(@Query() query: SearchDto) {
    if ((query.latitude === undefined) !== (query.longitude === undefined)) throw new BadRequestException('Both latitude and longitude are required');
    const term = (query.q ?? query.search ?? '').trim().toLowerCase();
    const prefix = `${term.replace(/[\\%_]/g, '\\$&')}%`;
    const contains = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
    const qb = this.db.getRepository(RestaurantEntity).createQueryBuilder('r')
      .where('r.approvalStatus = :approved AND r.isActive = true', { approved: RestaurantApprovalStatus.APPROVED });
    // Works on a fresh entity-generated schema without custom FULLTEXT indexes.
    if (term) qb.andWhere(`(LOWER(r.name) LIKE :contains OR LOWER(r.description) LIKE :contains
      OR LOWER(CAST(r.cuisines AS CHAR)) LIKE :contains OR LOWER(r.city) LIKE :contains
      OR EXISTS (SELECT 1 FROM menu_items m LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.restaurant_id = r.id AND m.deleted_at IS NULL AND (LOWER(m.name) LIKE :contains OR LOWER(m.description) LIKE :contains OR LOWER(c.name) LIKE :contains OR LOWER(CAST(m.cuisines AS CHAR)) LIKE :contains)))`, { contains });
    if (query.foodType) qb.andWhere('EXISTS (SELECT 1 FROM menu_items m WHERE m.restaurant_id = r.id AND m.deleted_at IS NULL AND m.food_type = :foodType)', { foodType: query.foodType });
    if (query.minimumRating !== undefined) qb.andWhere('r.averageRating >= :rating', { rating: query.minimumRating });
    if (query.latitude !== undefined) qb.andWhere('ST_Distance_Sphere(POINT(r.longitude, r.latitude), POINT(:longitude, :latitude)) <= r.deliveryRadiusKm * 1000', { latitude: query.latitude, longitude: query.longitude });
    if (term) qb.addSelect('CASE WHEN LOWER(r.name) = :term THEN 100 WHEN LOWER(r.name) LIKE :prefix THEN 80 ELSE 0 END', 'name_rank').setParameters({ term, prefix }).orderBy('name_rank', 'DESC');
    else qb.orderBy('r.averageRating', 'DESC');
    qb.addOrderBy('r.id', 'ASC');
    // Bound work per request. The response explicitly tells clients when to narrow the search.
    const candidates = await qb.take(1001).getMany();
    const truncated = candidates.length > 1000;
    const restaurants = candidates.slice(0, 1000);
    let dishes: MenuItemEntity[] = [];
    if (restaurants.length && term) {
      const menu = this.db.getRepository(MenuItemEntity).createQueryBuilder('m').leftJoinAndSelect('m.category', 'category')
        .where('m.restaurantId IN (:...ids)', { ids: restaurants.map(r => r.id) })
        .andWhere('(LOWER(m.name) LIKE :contains OR LOWER(m.description) LIKE :contains OR LOWER(category.name) LIKE :contains OR LOWER(CAST(m.cuisines AS CHAR)) LIKE :contains)', { contains });
      if (query.foodType) menu.andWhere('m.foodType = :foodType', { foodType: query.foodType });
      dishes = await menu.orderBy('m.name', 'ASC').take(5000).getMany();
    }
    const now = new Date();
    const dishesByRestaurant = new Map<number, MenuItemEntity[]>();
    for (const dish of dishes) {
      const id = Number(dish.restaurantId);
      const group = dishesByRestaurant.get(id) ?? [];
      group.push(dish); dishesByRestaurant.set(id, group);
    }
    const ranked = restaurants.map(r => {
      const availability = restaurantAvailability(r, now);
      const distanceKm = query.latitude === undefined ? null : haversineDistanceKm({ latitude: query.latitude, longitude: query.longitude! }, { latitude: Number(r.latitude), longitude: Number(r.longitude) });
      const matchingDishes = (dishesByRestaurant.get(Number(r.id)) ?? []).map(d => ({ ...d, ...menuPrice(d, now), ...menuAvailability(d, r, now) }));
      const rank = !term ? 0 : r.name.toLowerCase() === term ? 100 : r.name.toLowerCase().startsWith(term) ? 80 : matchingDishes.some(d => d.name.toLowerCase() === term) ? 75 : matchingDishes.some(d => d.name.toLowerCase().startsWith(term)) ? 60 : matchingDishes.length ? 40 : 15;
      const { availabilitySettings: _privateSettings, ...publicRestaurant } = r;
      return { ...publicRestaurant, ...availability, distanceKm, matchingDishes: matchingDishes.slice(0, 4), rank,
        isDeliverableToAddress: distanceKm === null ? null : distanceKm <= Number(r.deliveryRadiusKm) };
    }).filter(r => (!query.openNow || r.isAcceptingOrders) && r.isDeliverableToAddress !== false);
    ranked.sort((a, b) => Number(b.isAcceptingOrders) - Number(a.isAcceptingOrders) || b.rank - a.rank || (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || Number(b.averageRating) - Number(a.averageRating) || Number(a.id) - Number(b.id));
    return { items: ranked.slice((query.page - 1) * query.limit, query.page * query.limit), meta: { page: query.page, limit: query.limit, total: ranked.length, totalPages: Math.ceil(ranked.length / query.limit), truncated } };
  }
}
