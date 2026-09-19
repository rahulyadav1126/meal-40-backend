import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { MenuItemEntity, RestaurantEntity } from '@app/database';
import { CloudinaryFileStorageProvider } from '@app/integrations';
import { RestaurantsService } from '../restaurants/restaurants.service.js';
import type { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto.js';
@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItemEntity)
    private readonly items: Repository<MenuItemEntity>,
    private readonly restaurantService: RestaurantsService,
    private readonly storage: CloudinaryFileStorageProvider,
  ) {}
  publicMenu(restaurantId: number) {
    return this.items.find({
      where: { restaurantId, isAvailable: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
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
    await this.restaurantService.owned(userId, dto.restaurantId);
    const item = await this.items.save(
      this.items.create({
        ...dto,
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
    const item = await this.ownedItem(userId, id);
    if (dto.restaurantId && dto.restaurantId !== item.restaurantId)
      await this.restaurantService.owned(userId, dto.restaurantId);
    Object.assign(item, dto);
    return this.items.save(item);
  }
  async remove(userId: number, id: number) {
    const item = await this.ownedItem(userId, id);
    await this.items.softRemove(item);
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
