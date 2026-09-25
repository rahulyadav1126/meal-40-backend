import { Body, Controller, Module, Post, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TypeOrmModule, InjectRepository } from '@nestjs/typeorm';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, Roles } from '@app/auth';
import { type AuthenticatedUser, OrderStatus, UserRole } from '@app/contracts';
import { OrderEntity, ReviewEntity, RestaurantEntity } from '@app/database';
class CreateReviewDto {
  @IsInt() @Min(1) orderId: number;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsString() @MaxLength(2000) @IsOptional() comment?: string;
}
@Injectable()
class ReviewsService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly reviews: Repository<ReviewEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
  ) {}
  async create(customerId: number, dto: CreateReviewDto) {
    return this.orders.manager.transaction(async manager => {
    const order = await manager.findOne(OrderEntity, { where: { id: dto.orderId, customerId }, lock: { mode: 'pessimistic_write' } });
    if (!order || order.orderStatus !== OrderStatus.DELIVERED)
      throw new NotFoundException('Delivered order not found');
    await manager.findOneOrFail(RestaurantEntity, { where: { id: order.restaurantId }, lock: { mode: 'pessimistic_write' } });
    if (await manager.exists(ReviewEntity, { where: { orderId: order.id } }))
      throw new ConflictException('Order has already been reviewed');
    const review = await manager.save(ReviewEntity,
      this.reviews.create({
        customerId,
        restaurantId: order.restaurantId,
        orderId: order.id,
        rating: dto.rating,
        comment: dto.comment ?? null,
        isVisible: true,
      }),
    );
    const totals = await manager.getRepository(ReviewEntity).createQueryBuilder('r').select('AVG(r.rating)', 'average').addSelect('COUNT(*)', 'count').where('r.restaurantId = :id AND r.isVisible = true', { id: order.restaurantId }).getRawOne();
    await manager.update(RestaurantEntity, order.restaurantId, { averageRating: Number(totals.average).toFixed(2), ratingCount: Number(totals.count) });
    return review;
    });
  }
  async merchantList(merchantId: number) {
    const reviews = await this.reviews.createQueryBuilder('review').innerJoin('review.restaurant', 'restaurant')
      .leftJoinAndSelect('review.customer', 'customer').where('restaurant.merchantId = :merchantId AND review.isVisible = true', { merchantId })
      .orderBy('review.createdAt', 'DESC').take(500).getMany();
    return reviews.map(({ customer, ...review }) => ({ ...review, customer: customer ? { id: customer.id, name: customer.name } : null }));
  }
}
@ApiBearerAuth()
@Roles(UserRole.MERCHANT)
@Controller('merchant/reviews')
class MerchantReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.reviews.merchantList(user.sub); }
}
@ApiBearerAuth()
@ApiTags('Reviews')
@Roles(UserRole.CUSTOMER)
@Controller('reviews')
class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user.sub, dto);
  }
}
@Module({
  imports: [TypeOrmModule.forFeature([ReviewEntity, OrderEntity])],
  controllers: [ReviewsController, MerchantReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
