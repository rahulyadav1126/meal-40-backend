import {
  Body,
  Headers,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@app/auth';
import { type AuthenticatedUser, OrderStatus, UserRole } from '@app/contracts';
import {
  CancelOrderDto,
  CreateOrderDto,
  OrderNoteDto,
} from './dto/orders.dto.js';
import { OrdersService } from './services/orders.service.js';
@ApiBearerAuth()
@ApiTags('Orders')
@Roles(UserRole.CUSTOMER)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post('quote') quote(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(user.sub, dto, undefined, true);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') requestKey?: string,
  ) {
    return this.orders.create(user.sub, dto, requestKey);
  }
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.listCustomer(user.sub);
  }
  @Get(':id') get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orders.customerGet(user.sub, id);
  }
  @Patch(':id/cancel') cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orders.customerCancel(user.sub, id, dto.reason);
  }
}
@ApiBearerAuth()
@ApiTags('Merchant Orders')
@Roles(UserRole.MERCHANT)
@Controller('merchant/orders')
export class MerchantOrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Get(':id') get(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.orders.merchantGet(user.sub, id);
  }
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.merchantList(user.sub);
  }
  @Patch(':id/accept') accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orders.merchantTransition(user.sub, id, OrderStatus.ACCEPTED);
  }
  @Patch(':id/reject') reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OrderNoteDto,
  ) {
    return this.orders.merchantTransition(
      user.sub,
      id,
      OrderStatus.REJECTED,
      dto.note,
    );
  }
  @Patch(':id/preparing') preparing(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orders.merchantTransition(user.sub, id, OrderStatus.PREPARING);
  }
  @Patch(':id/ready') ready(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orders.merchantTransition(user.sub, id, OrderStatus.READY);
  }
}
