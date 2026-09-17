import { Body, Controller, Module, Post } from '@nestjs/common';
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
import { OrderEntity, ReviewEntity } from '@app/database';
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
    const order = await this.orders.findOneBy({ id: dto.orderId, customerId });
    if (!order || order.orderStatus !== OrderStatus.DELIVERED)
      throw new NotFoundException('Delivered order not found');
    if (await this.reviews.exists({ where: { orderId: order.id } }))
      throw new ConflictException('Order has already been reviewed');
    return this.reviews.save(
      this.reviews.create({
        customerId,
        restaurantId: order.restaurantId,
        orderId: order.id,
        rating: dto.rating,
        comment: dto.comment ?? null,
        isVisible: true,
      }),
    );
  }
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
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
