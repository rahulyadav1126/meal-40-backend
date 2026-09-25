import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { restaurantAvailability } from '@app/common';
import { AvailabilityDto, validateAvailability } from './dto/availability.dto.js';
import {
  DEFAULT_COUNTRY,
  RestaurantApprovalStatus,
  RestaurantOpeningStatus,
  RestaurantSortField,
  SortOrder,
  UserRole,
} from '@app/contracts';
import { RestaurantEntity } from '@app/database';
import type { AuthenticatedUser, PaginatedResult } from '@app/contracts';
import type {
  CreateRestaurantDto,
  RestaurantQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto.js';

@Injectable()
export class RestaurantsService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurants: Repository<RestaurantEntity>,
  ) {}
  async publicList(
    query: RestaurantQueryDto,
  ): Promise<PaginatedResult<RestaurantEntity>> {
    const qb = this.restaurants
      .createQueryBuilder('restaurant')
      .where('restaurant.approvalStatus = :approval', {
        approval: RestaurantApprovalStatus.APPROVED,
      })
      .andWhere('restaurant.isActive = :active', { active: true });
    if (query.search)
      qb.andWhere(
        '(restaurant.name LIKE :search OR restaurant.description LIKE :search)',
        { search: `%${query.search}%` },
      );
    if (query.minimumRating !== undefined)
      qb.andWhere('restaurant.averageRating >= :rating', {
        rating: query.minimumRating,
      });
    if (query.foodType) qb.andWhere('EXISTS (SELECT 1 FROM menu_items item WHERE item.restaurant_id = restaurant.id AND item.deleted_at IS NULL AND item.food_type = :foodType)', { foodType: query.foodType });
    const [items, total] = await qb
      .orderBy(
        `restaurant.${query.sortBy ?? RestaurantSortField.CREATED_AT}`,
        query.sortOrder ?? SortOrder.DESC,
      )
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      items: items.map(item => Object.assign(item, restaurantAvailability(item))),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
  async publicGet(id: number): Promise<RestaurantEntity> {
    const restaurant = await this.restaurants.findOneBy({
      id,
      approvalStatus: RestaurantApprovalStatus.APPROVED,
      isActive: true,
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return Object.assign(restaurant, restaurantAvailability(restaurant));
  }
  async merchantList(userId: number) {
    const items = await this.restaurants.find({ where: { merchantId: userId } });
    return items.map(item => Object.assign(item, restaurantAvailability(item)));
  }
  async create(user: AuthenticatedUser, dto: CreateRestaurantDto) {
    this.validateCommercialSettings(dto);
    if (user.role !== UserRole.MERCHANT)
      throw new ForbiddenException('Merchant role required');
    return this.restaurants.save(
      this.restaurants.create({
        ...dto,
        uuid: randomUUID(),
        slug: await this.uniqueSlug(dto.name),
        merchantId: user.sub,
        country: DEFAULT_COUNTRY,
        approvalStatus: RestaurantApprovalStatus.PENDING,
        openingStatus: RestaurantOpeningStatus.CLOSED,
        isActive: false,
      }),
    );
  }
  async update(userId: number, id: number, dto: UpdateRestaurantDto) {
    this.validateCommercialSettings(dto);
    return this.restaurants.manager.transaction(async manager => {
      const restaurant = await manager.findOne(RestaurantEntity, { where: { id, merchantId: userId }, lock: { mode: 'pessimistic_write' } });
      if (!restaurant) throw new NotFoundException('Restaurant not found');
      if (dto.openingStatus) {
        restaurant.availabilitySettings = {
          timezone: 'Asia/Kolkata', weeklyHours: [], exceptions: [], ...restaurant.availabilitySettings,
          availabilityMode: dto.openingStatus === RestaurantOpeningStatus.OPEN ? 'FORCED_OPEN' : 'FORCED_CLOSED',
          overrideExpiresAt: null, overrideReason: 'Changed manually',
        };
        restaurant.availabilityVersion++;
      }
      Object.assign(restaurant, dto);
      await manager.save(restaurant);
      if (dto.openingStatus) await manager.query('INSERT INTO restaurant_availability_audit (restaurant_id, actor_user_id, version, settings) VALUES (?, ?, ?, ?)', [id, userId, restaurant.availabilityVersion, JSON.stringify(restaurant.availabilitySettings)]);
      return Object.assign(restaurant, restaurantAvailability(restaurant));
    });
  }
  async updateAvailability(userId: number, id: number, dto: AvailabilityDto) {
    validateAvailability(dto);
    return this.restaurants.manager.transaction(async manager => {
      const restaurant = await manager.findOne(RestaurantEntity, { where: { id, merchantId: userId }, lock: { mode: 'pessimistic_write' } });
      if (!restaurant) throw new NotFoundException('Restaurant not found');
      if (restaurant.availabilityVersion !== dto.expectedVersion) throw new ConflictException('Settings changed. Refresh before saving.');
      const { expectedVersion: _version, ...settings } = dto;
      restaurant.availabilitySettings = { ...settings, overrideExpiresAt: settings.availabilityMode === 'SCHEDULED' ? null : settings.overrideExpiresAt ?? null };
      restaurant.availabilityVersion++;
      await manager.save(restaurant);
      await manager.query('INSERT INTO restaurant_availability_audit (restaurant_id, actor_user_id, version, settings) VALUES (?, ?, ?, ?)', [id, userId, restaurant.availabilityVersion, JSON.stringify(restaurant.availabilitySettings)]);
      return Object.assign(restaurant, restaurantAvailability(restaurant));
    });
  }
  private validateCommercialSettings(dto: Partial<CreateRestaurantDto>) {
    if (dto.minimumOrderAmount !== undefined && (typeof dto.minimumOrderAmount !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(dto.minimumOrderAmount))) throw new BadRequestException('Minimum order amount must be a non-negative amount with at most two decimal places');
    if (dto.deliveryRadiusKm !== undefined && (typeof dto.deliveryRadiusKm !== 'string' || !/^\d{1,4}(\.\d{1,2})?$/.test(dto.deliveryRadiusKm) || Number(dto.deliveryRadiusKm) <= 0)) throw new BadRequestException('Delivery radius must be positive with at most two decimal places');
  }
  async owned(userId: number, id: number): Promise<RestaurantEntity> {
    const restaurant = await this.restaurants.findOneBy({ id });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (Number(restaurant.merchantId) !== Number(userId))
      throw new ForbiddenException('Restaurant does not belong to merchant');
    return restaurant;
  }
  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.restaurants.exists({ where: { slug } }))
      slug = `${base}-${suffix++}`;
    return slug;
  }
}
