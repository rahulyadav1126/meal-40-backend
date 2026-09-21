import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthSharedModule, JwtAuthGuard, RolesGuard } from '@app/auth';
import { Plate40LoggerModule } from '@app/common';
import { Plate40ConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { AddressesModule } from './modules/addresses/addresses.module.js';
import { AdminModule } from './modules/admin/admin.controller.js';
import { CartModule } from './modules/cart/cart.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { LocationsModule } from './modules/locations/locations.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { RealtimeModule } from './modules/realtime/realtime.module.js';
import { RestaurantsModule } from './modules/restaurants/restaurants.module.js';
import { ReviewsModule } from './modules/reviews/reviews.module.js';
<<<<<<< Updated upstream
import { DeliveryModule } from './modules/delivery/delivery.module.js';
=======
>>>>>>> Stashed changes
import { UsersModule } from './modules/users/users.module.js';
@Module({
  imports: [
    Plate40ConfigModule.forRoot(['.env.main', '.env']),
    Plate40LoggerModule,
    DatabaseModule,
    AuthSharedModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    AddressesModule,
    AdminModule,
    CartModule,
    CategoriesModule,
    HealthModule,
    MenuModule,
    LocationsModule,
    NotificationsModule,
    OrdersModule,
    PaymentsModule,
    RealtimeModule,
    RestaurantsModule,
    ReviewsModule,
<<<<<<< Updated upstream
    DeliveryModule,
=======
>>>>>>> Stashed changes
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
