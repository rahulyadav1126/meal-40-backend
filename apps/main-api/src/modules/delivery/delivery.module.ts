import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DeliveryEarningEntity,
  DeliveryEntity,
  DeliveryPartnerDocumentEntity,
  DeliveryPartnerEntity,
  NotificationEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
  UserEntity,
} from '@app/database';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import {
  AdminDeliveryController,
  DeliveryController,
} from './delivery.controller.js';
import { DeliveryService } from './delivery.service.js';
import { DeliveryNotificationsWorker } from './delivery-notifications.worker.js';
import { TrackingController } from './tracking.controller.js';
import { TrackingService } from './tracking.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryPartnerEntity,
      DeliveryPartnerDocumentEntity,
      DeliveryEntity,
      DeliveryEarningEntity,
      NotificationEntity,
      OrderEntity,
      OrderItemEntity,
      OrderStatusHistoryEntity,
      UserEntity,
    ]),
    NotificationsModule,
    OrdersModule,
    RealtimeModule,
  ],
  controllers: [DeliveryController, AdminDeliveryController, TrackingController],
  providers: [DeliveryService, DeliveryNotificationsWorker, TrackingService],
})
export class DeliveryModule {}
