import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { MenuItemEntity, RestaurantEntity } from '@app/database';
import { CloudinaryFileStorageProvider } from '@app/integrations';
import { RestaurantsService } from '../restaurants/restaurants.service.js';
import { menuAvailability, menuPrice, Money } from '@app/common';
import { validateIntervals } from '../restaurants/dto/availability.dto.js';
import type { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto.js';
@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItemEntity)
    private readonly items: Repository<MenuItemEntity>,
    private readonly restaurantService: RestaurantsService,
    private readonly storage: CloudinaryFileStorageProvider,
  ) {}
  async publicMenu(restaurantId: number) {
    const restaurant = await this.restaurantService.publicGet(restaurantId);
    const items = await this.items.find({
      where: { restaurantId },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    return items.map(item => ({ ...item, ...menuPrice(item), ...menuAvailability(item, restaurant) }));
  }
  merchantMenu(userId: number) {
    return this.items
      .createQueryBuilder('item')
      .innerJoin(
        RestaurantEntity,
        'restaurant',
        'restaurant.id = item.restaurantId',
      )
      .where('restaurant.merchantId = :userId', { userId })
      .getMany();
  }
  async create(userId: number, dto: CreateMenuItemDto) {
    this.validatePricing(dto);
    if (dto.serviceHours) validateIntervals(dto.serviceHours, true);
    await this.restaurantService.owned(userId, dto.restaurantId);
    const item = await this.items.save(
      this.items.create({
        ...dto,
        discountStartsAt: dto.discountStartsAt ? new Date(dto.discountStartsAt) : null,
        discountEndsAt: dto.discountEndsAt ? new Date(dto.discountEndsAt) : null,
        soldOutUntil: dto.soldOutUntil ? new Date(dto.soldOutUntil) : null,
        uuid: randomUUID(),
        slug: await this.slug(dto.restaurantId, dto.name),
        isAvailable: dto.isAvailable ?? true,
        isFeatured: false,
        displayOrder: dto.displayOrder ?? 0,
      }),
    );
    return item;
  }
  async update(userId: number, id: number, dto: UpdateMenuItemDto) {
    if (dto.serviceHours) validateIntervals(dto.serviceHours, true);
    const existing = await this.ownedItem(userId, id);
    if (dto.restaurantId && Number(dto.restaurantId) !== Number(existing.restaurantId))
      throw new BadRequestException('Create a separate menu item to move it to another restaurant');
    return this.items.manager.transaction(async manager => {
      const restaurant = await manager.findOne(RestaurantEntity, { where: { id: existing.restaurantId, merchantId: userId }, lock: { mode: 'pessimistic_write' } });
      if (!restaurant) throw new NotFoundException('Restaurant not found');
      const item = await manager.findOne(MenuItemEntity, { where: { id, restaurantId: restaurant.id }, lock: { mode: 'pessimistic_write' } });
      if (!item) throw new NotFoundException('Menu item not found');
      Object.assign(item, dto);
      if (dto.discountStartsAt !== undefined) item.discountStartsAt = dto.discountStartsAt ? new Date(dto.discountStartsAt) : null;
      if (dto.discountEndsAt !== undefined) item.discountEndsAt = dto.discountEndsAt ? new Date(dto.discountEndsAt) : null;
      this.validatePricing(item);
      if (dto.soldOutUntil !== undefined) item.soldOutUntil = dto.soldOutUntil ? new Date(dto.soldOutUntil) : null;
      return manager.save(item);
    });
  }
  async remove(userId: number, id: number) {
    const item = await this.ownedItem(userId, id);
    await this.items.manager.transaction(async manager => {
      const restaurant = await manager.findOne(RestaurantEntity, { where: { id: item.restaurantId, merchantId: userId }, lock: { mode: 'pessimistic_write' } });
      if (!restaurant) throw new NotFoundException('Restaurant not found');
      await manager.softDelete(MenuItemEntity, { id: item.id, restaurantId: restaurant.id });
    });
  }
  uploadImage(userId: number, buffer: Buffer) {
    return this.storage.upload({
      buffer,
      folder: `plate40/menu/${userId}`,
      publicId: randomUUID(),
    });
  }
  private async ownedItem(userId: number, id: number) {
    const item = await this.items.findOneBy({ id });
    if (!item) throw new NotFoundException('Menu item not found');
    await this.restaurantService.owned(userId, item.restaurantId);
    return item;
  }
  private validatePricing(item: { price: string; discountedPrice?: string | null; discountStartsAt?: Date | string | null; discountEndsAt?: Date | string | null }) {
    const validMoney = (value: string) => /^\d{1,8}(\.\d{1,2})?$/.test(value);
    if (!validMoney(item.price) || Number(item.price) <= 0) throw new BadRequestException('Price must be positive with at most two decimal places');
    if (item.discountedPrice != null && (!validMoney(item.discountedPrice) || !Money.fromDecimal(item.discountedPrice).isLessThan(Money.fromDecimal(item.price)))) throw new BadRequestException('Discounted price must be non-negative and below the base price');
    if (item.discountStartsAt && item.discountEndsAt && new Date(item.discountStartsAt) >= new Date(item.discountEndsAt)) throw new BadRequestException('Discount end must be after its start');
  }
  private async slug(restaurantId: number, name: string) {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.items.exists({ where: { restaurantId, slug } }))
      slug = `${base}-${suffix++}`;
    return slug;
  }
}
