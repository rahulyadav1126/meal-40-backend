import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryEarningEntity,
  DeliveryEntity,
  DeliveryPartnerDocumentEntity,
  DeliveryPartnerEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
  UserEntity,
} from '@app/database';
import { OrdersModule } from '../orders/orders.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import {
  AdminDeliveryController,
  DeliveryController,
} from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryPartnerEntity,
      DeliveryPartnerDocumentEntity,
      DeliveryEntity,
      DeliveryEarningEntity,
      OrderEntity,
      OrderItemEntity,
      OrderStatusHistoryEntity,
      UserEntity,
    ]),
    OrdersModule,
    RealtimeModule,
  ],
  controllers: [DeliveryController, AdminDeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
