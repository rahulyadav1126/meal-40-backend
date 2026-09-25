import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';
import { DataSource, In } from 'typeorm';
import { CurrentUser, Public, Roles } from '@app/auth';
import { type AuthenticatedUser, DiscountType, RestaurantApprovalStatus, UserRole } from '@app/contracts';
import { CouponEntity, MenuItemEntity, RestaurantEntity } from '@app/database';

class OfferDto {
  @IsInt() @Min(1) restaurantId: number;
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value) @Matches(/^[A-Z0-9_-]{3,50}$/) code: string;
  @IsOptional() @IsString() @MaxLength(500) description?: string | null;
  @IsEnum(DiscountType) discountType: DiscountType;
  @Matches(/^\d{1,8}(\.\d{1,2})?$/) discountValue: string;
  @Matches(/^\d{1,8}(\.\d{1,2})?$/) minimumOrderAmount: string;
  @IsOptional() @Matches(/^\d{1,8}(\.\d{1,2})?$/) maximumDiscount?: string | null;
  @IsISO8601() startAt: string;
  @IsISO8601() expiresAt: string;
  @IsOptional() @IsInt() @Min(1) totalUsageLimit?: number | null;
  @IsInt() @Min(1) perUserUsageLimit: number;
  @IsBoolean() isActive: boolean;
  @IsBoolean() stackWithDishDiscount: boolean;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @IsInt({ each: true }) @Min(1, { each: true }) menuItemIds?: number[] | null;
}
class UpdateOfferDto extends PartialType(OfferDto) { @IsInt() @Min(0) expectedVersion: number; }

@Injectable()
class OffersService {
  constructor(private readonly db: DataSource) {}
  async list(userId: number) {
    return this.db.getRepository(CouponEntity).createQueryBuilder('c').innerJoin(RestaurantEntity, 'r', 'r.id = c.restaurantId')
      .where('r.merchantId = :userId', { userId }).orderBy('c.createdAt', 'DESC').getMany();
  }
  async publicList(restaurantId: number) {
    const restaurant = await this.db.getRepository(RestaurantEntity).findOneBy({ id: restaurantId, isActive: true, approvalStatus: RestaurantApprovalStatus.APPROVED });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    return this.db.getRepository(CouponEntity).createQueryBuilder('c')
      .where('c.restaurantId = :restaurantId AND c.isActive = true AND c.startAt <= :now AND c.expiresAt > :now', { restaurantId, now: new Date() })
      .andWhere('(c.totalUsageLimit IS NULL OR c.totalUsageLimit > (SELECT COUNT(*) FROM coupon_usages u WHERE u.coupon_id = c.id))')
      .orderBy('c.expiresAt', 'ASC').take(100).getMany();
  }
  async save(userId: number, dto: OfferDto | UpdateOfferDto, id?: number) {
    try {
      return await this.db.transaction(async manager => {
        const existing = id ? await manager.findOneBy(CouponEntity, { id }) : null;
        const restaurantId = existing?.restaurantId ?? dto.restaurantId;
        if (!restaurantId) throw new NotFoundException('Merchant offer not found');
        // Restaurant then coupon: same lock order as checkout.
        const restaurant = await manager.findOne(RestaurantEntity, { where: { id: restaurantId, merchantId: userId }, lock: { mode: 'pessimistic_write' } });
        if (!restaurant) throw new NotFoundException('Restaurant not found');
        const coupon = id ? await manager.findOne(CouponEntity, { where: { id, restaurantId }, lock: { mode: 'pessimistic_write' } }) : manager.create(CouponEntity, { restaurantId, version: 0, menuItemIds: null, maximumDiscount: null, totalUsageLimit: null, description: null });
        if (!coupon) throw new NotFoundException('Offer not found');
        if (id && coupon.version !== (dto as UpdateOfferDto).expectedVersion) throw new ConflictException('Offer changed. Refresh before saving.');
        if (dto.restaurantId && Number(dto.restaurantId) !== Number(restaurantId)) throw new BadRequestException('Offers cannot move between restaurants');
        const { expectedVersion: _expected, ...changes } = dto as UpdateOfferDto;
        Object.assign(coupon, changes);
        coupon.restaurantId = restaurant.id;
        const amount = /^\d{1,8}(\.\d{1,2})?$/;
        if (typeof coupon.code !== 'string' || !/^[A-Z0-9_-]{3,50}$/.test(coupon.code) || !Object.values(DiscountType).includes(coupon.discountType)
          || typeof coupon.discountValue !== 'string' || !amount.test(coupon.discountValue)
          || typeof coupon.minimumOrderAmount !== 'string' || !amount.test(coupon.minimumOrderAmount)
          || (coupon.maximumDiscount !== null && (typeof coupon.maximumDiscount !== 'string' || !amount.test(coupon.maximumDiscount)))
          || typeof coupon.isActive !== 'boolean' || typeof coupon.stackWithDishDiscount !== 'boolean'
          || !Number.isInteger(coupon.perUserUsageLimit) || coupon.perUserUsageLimit < 1
          || (coupon.totalUsageLimit !== null && (!Number.isInteger(coupon.totalUsageLimit) || coupon.totalUsageLimit < 1))
          || dto.startAt === null || dto.expiresAt === null) throw new BadRequestException('Invalid offer terms');
        if (dto.startAt !== undefined) coupon.startAt = new Date(dto.startAt);
        if (dto.expiresAt !== undefined) coupon.expiresAt = new Date(dto.expiresAt);
        if (Number(coupon.discountValue) <= 0 || (coupon.discountType === DiscountType.PERCENTAGE && Number(coupon.discountValue) > 100)) throw new BadRequestException('Enter a positive discount; percentage discounts cannot exceed 100');
        if (coupon.maximumDiscount !== null && Number(coupon.maximumDiscount) <= 0) throw new BadRequestException('Maximum discount must be positive');
        if (!(coupon.startAt < coupon.expiresAt)) throw new BadRequestException('Offer end must be after its start');
        if (coupon.menuItemIds?.length && await manager.count(MenuItemEntity, { where: { id: In(coupon.menuItemIds), restaurantId } }) !== coupon.menuItemIds.length) throw new BadRequestException('All selected dishes must belong to this restaurant');
        coupon.version++;
        await manager.save(coupon);
        await manager.query('INSERT INTO merchant_offer_audit (coupon_id, actor_user_id, version, terms) VALUES (?, ?, ?, ?)', [coupon.id, userId, coupon.version, JSON.stringify(coupon)]);
        return coupon;
      });
    } catch (error) {
      if ((error as { driverError?: { code?: string } }).driverError?.code === 'ER_DUP_ENTRY') throw new ConflictException('This offer code is already used. Choose a unique code.');
      throw error;
    }
  }
}
@Roles(UserRole.MERCHANT)
@Controller('merchant/offers')
class MerchantOffersController {
  constructor(private readonly service: OffersService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user.sub); }
  @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: OfferDto) { return this.service.save(user.sub, dto); }
  @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOfferDto) { return this.service.save(user.sub, dto, id); }
}
@Public()
@Controller('restaurants/:id/offers')
class PublicOffersController {
  constructor(private readonly service: OffersService) {}
  @Get() list(@Param('id', ParseIntPipe) id: number) { return this.service.publicList(id); }
}
@Module({ controllers: [MerchantOffersController, PublicOffersController], providers: [OffersService] })
export class OffersModule {}
