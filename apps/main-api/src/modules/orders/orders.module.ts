import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryEntity,
  DeliveryPartnerEntity,
  NotificationEntity,
  OrderEntity,
  OrderStatusHistoryEntity,
  RestaurantEntity,
} from '@app/database';
import { RealtimeModule } from '../realtime/realtime.module.js';
import {
  MerchantOrdersController,
  OrdersController,
} from './orders.controller.js';
import { OrderPricingService } from './services/order-pricing.service.js';
import { OrderStateService } from './services/order-state.service.js';
import { OrdersService } from './services/orders.service.js';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryEntity,
      DeliveryPartnerEntity,
      NotificationEntity,
      OrderEntity,
      OrderStatusHistoryEntity,
      RestaurantEntity,
    ]),
    RealtimeModule,
  ],
  controllers: [OrdersController, MerchantOrdersController],
  providers: [OrdersService, OrderPricingService, OrderStateService],
  exports: [OrdersService, OrderStateService],
})
export class OrdersModule {}
