import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { IsString, MaxLength } from 'class-validator';
import { Repository } from 'typeorm';
import { CurrentUser, Roles } from '@app/auth';
import {
  AuditAction,
  AuditEntityType,
  type AuthenticatedUser,
  OrderStatus,
  RestaurantApprovalStatus,
  UserRole,
  UserStatus,
} from '@app/contracts';
import {
  AuditLogEntity,
  OrderEntity,
  RestaurantEntity,
  UserEntity,
} from '@app/database';
class ReasonDto {
  @IsString() @MaxLength(500) reason: string;
}
@Injectable()
class AdminService {
  constructor(
    @InjectRepository(RestaurantEntity)
    private readonly restaurants: Repository<RestaurantEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(AuditLogEntity)
    private readonly audits: Repository<AuditLogEntity>,
  ) {}
  listRestaurants() {
    return this.restaurants.find({
      withDeleted: true,
      order: { createdAt: 'DESC' },
    });
  }
  listUsers() {
    return this.users.find({ withDeleted: true, order: { createdAt: 'DESC' } });
  }
  listOrders() {
    return this.orders.find({ order: { createdAt: 'DESC' } });
  }
  async restaurant(
    actor: number,
    id: number,
    status: RestaurantApprovalStatus,
    action: AuditAction,
    reason?: string,
  ) {
    const entity = await this.restaurants.findOneBy({ id });
    if (!entity) throw new NotFoundException('Restaurant not found');
    const old = entity.approvalStatus;
    entity.approvalStatus = status;
    entity.isActive = status === RestaurantApprovalStatus.APPROVED;
    await this.restaurants.save(entity);
    await this.audit(
      actor,
      action,
      AuditEntityType.RESTAURANT,
      id,
      { approvalStatus: old },
      { approvalStatus: status, reason },
    );
    return entity;
  }
  async user(
    actor: number,
    id: number,
    status: UserStatus,
    action: AuditAction,
  ) {
    const entity = await this.users.findOneBy({ id });
    if (!entity) throw new NotFoundException('User not found');
    const old = entity.status;
    entity.status = status;
    await this.users.save(entity);
    await this.audit(
      actor,
      action,
      AuditEntityType.USER,
      id,
      { status: old },
      { status },
    );
    return entity;
  }
  async dashboard() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const [
      totalOrders,
      todayOrders,
      totalCustomers,
      totalMerchants,
      activeRestaurants,
      pendingApprovals,
      cancelledOrders,
      completedOrders,
    ] = await Promise.all([
      this.orders.count(),
      this.orders
        .createQueryBuilder('order')
        .where('order.createdAt >= :today', { today })
        .getCount(),
      this.users.countBy({ role: UserRole.CUSTOMER }),
      this.users.countBy({ role: UserRole.MERCHANT }),
      this.restaurants.countBy({
        approvalStatus: RestaurantApprovalStatus.APPROVED,
        isActive: true,
      }),
      this.restaurants.countBy({
        approvalStatus: RestaurantApprovalStatus.PENDING,
      }),
      this.orders.countBy({ orderStatus: OrderStatus.CANCELLED }),
      this.orders.countBy({ orderStatus: OrderStatus.DELIVERED }),
    ]);
    const revenue = await this.orders
      .createQueryBuilder('order')
      .select('COALESCE(SUM(order.totalAmount), 0)', 'total')
      .addSelect(
        'COALESCE(SUM(CASE WHEN order.createdAt >= :today THEN order.totalAmount ELSE 0 END), 0)',
        'today',
      )
      .where('order.orderStatus = :status', {
        status: OrderStatus.DELIVERED,
        today,
      })
      .getRawOne<{ total: string; today: string }>();
    return {
      totalOrders,
      todayOrders,
      totalCustomers,
      totalMerchants,
      activeRestaurants,
      pendingApprovals,
      totalRevenue: revenue?.total ?? '0.00',
      todayRevenue: revenue?.today ?? '0.00',
      cancelledOrders,
      completedOrders,
    };
  }
  private async audit(
    actorUserId: number,
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: number,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
  ) {
    await this.audits.save(
      this.audits.create({
        actorUserId,
        action,
        entityType,
        entityId: String(entityId),
        oldValues,
        newValues,
      }),
    );
  }
}
@ApiBearerAuth()
@ApiTags('Admin')
@Roles(UserRole.ADMIN)
@Controller('admin')
class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('dashboard') dashboard() {
    return this.admin.dashboard();
  }
  @Get('restaurants') restaurants() {
    return this.admin.listRestaurants();
  }
  @Patch('restaurants/:id/approve') approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.restaurant(
      user.sub,
      id,
      RestaurantApprovalStatus.APPROVED,
      AuditAction.RESTAURANT_APPROVED,
    );
  }
  @Patch('restaurants/:id/reject') reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReasonDto,
  ) {
    return this.admin.restaurant(
      user.sub,
      id,
      RestaurantApprovalStatus.REJECTED,
      AuditAction.RESTAURANT_REJECTED,
      dto.reason,
    );
  }
  @Patch('restaurants/:id/suspend') suspend(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReasonDto,
  ) {
    return this.admin.restaurant(
      user.sub,
      id,
      RestaurantApprovalStatus.SUSPENDED,
      AuditAction.RESTAURANT_SUSPENDED,
      dto.reason,
    );
  }
  @Get('orders') orders() {
    return this.admin.listOrders();
  }
  @Get('users') users() {
    return this.admin.listUsers();
  }
  @Patch('users/:id/block') block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.user(
      user.sub,
      id,
      UserStatus.BLOCKED,
      AuditAction.USER_BLOCKED,
    );
  }
  @Patch('users/:id/unblock') unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.user(
      user.sub,
      id,
      UserStatus.ACTIVE,
      AuditAction.USER_UNBLOCKED,
    );
  }
}
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RestaurantEntity,
      UserEntity,
      OrderEntity,
      AuditLogEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
