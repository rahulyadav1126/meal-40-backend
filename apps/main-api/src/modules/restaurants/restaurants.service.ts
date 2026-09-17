import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
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
    const [items, total] = await qb
      .orderBy(
        `restaurant.${query.sortBy ?? RestaurantSortField.CREATED_AT}`,
        query.sortOrder ?? SortOrder.DESC,
      )
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return {
      items,
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
    return restaurant;
  }
  async merchantList(userId: number) {
    return this.restaurants.find({ where: { merchantId: userId } });
  }
  async create(user: AuthenticatedUser, dto: CreateRestaurantDto) {
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
        isActive: true,
      }),
    );
  }
  async update(userId: number, id: number, dto: UpdateRestaurantDto) {
    const restaurant = await this.owned(userId, id);
    Object.assign(restaurant, dto);
    return this.restaurants.save(restaurant);
  }
  async owned(userId: number, id: number): Promise<RestaurantEntity> {
    const restaurant = await this.restaurants.findOneBy({ id });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (restaurant.merchantId !== userId)
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
