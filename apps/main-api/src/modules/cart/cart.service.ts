import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MenuItemEntity, CartEntity, CartItemEntity } from '@app/database';
import { ErrorCode } from '@app/contracts';
import { DomainException } from '@app/common';
@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartEntity)
    private readonly carts: Repository<CartEntity>,
    @InjectRepository(CartItemEntity)
    private readonly items: Repository<CartItemEntity>,
    @InjectRepository(MenuItemEntity)
    private readonly menu: Repository<MenuItemEntity>,
    private readonly dataSource: DataSource,
  ) {}
  list(userId: number) {
    return this.carts.find({
      where: { userId },
      relations: { restaurant: true },
    });
  }
  async itemsForCart(userId: number, cartId: number) {
    await this.ownedCart(userId, cartId);
    return this.items.find({
      where: { cartId },
      relations: { menuItem: true },
    });
  }
  async add(userId: number, menuItemId: number, quantity: number) {
    const menuItem = await this.menu.findOneBy({ id: menuItemId });
    if (!menuItem) throw new NotFoundException(ErrorCode.MENU_ITEM_NOT_FOUND);
    if (!menuItem.isAvailable)
      throw new DomainException(
        ErrorCode.MENU_ITEM_UNAVAILABLE,
        'Menu item is unavailable',
      );
    return this.dataSource.transaction(async (manager) => {
      let cart = await manager.findOne(CartEntity, {
        where: { userId, restaurantId: menuItem.restaurantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cart)
        cart = await manager.save(
          CartEntity,
          manager.create(CartEntity, {
            userId,
            restaurantId: menuItem.restaurantId,
          }),
        );
      let item = await manager.findOneBy(CartItemEntity, {
        cartId: cart.id,
        menuItemId,
      });
      if (item) item.quantity += quantity;
      else
        item = manager.create(CartItemEntity, {
          cartId: cart.id,
          menuItemId,
          quantity,
        });
      return manager.save(CartItemEntity, item);
    });
  }
  async update(userId: number, itemId: number, quantity: number) {
    const item = await this.ownedItem(userId, itemId);
    item.quantity = quantity;
    return this.items.save(item);
  }
  async removeItem(userId: number, itemId: number) {
    const item = await this.ownedItem(userId, itemId);
    await this.items.remove(item);
  }
  async clear(userId: number, cartId: number) {
    await this.ownedCart(userId, cartId);
    await this.carts.delete(cartId);
  }
  private async ownedCart(userId: number, id: number) {
    const cart = await this.carts.findOneBy({ id });
    if (!cart) throw new NotFoundException('Cart not found');
    if (cart.userId !== userId)
      throw new ForbiddenException('Cart does not belong to customer');
    return cart;
  }
  private async ownedItem(userId: number, id: number) {
    const item = await this.items.findOne({
      where: { id },
      relations: { cart: true },
    });
    if (!item) throw new NotFoundException('Cart item not found');
    if (item.cart.userId !== userId)
      throw new ForbiddenException('Cart item does not belong to customer');
    return item;
  }
}
