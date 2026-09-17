import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantEntity } from '@app/database';
import {
  MerchantRestaurantsController,
  RestaurantsController,
} from './restaurants.controller.js';
import { RestaurantsService } from './restaurants.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([RestaurantEntity])],
  controllers: [RestaurantsController, MerchantRestaurantsController],
  providers: [RestaurantsService],
  exports: [RestaurantsService],
})
export class RestaurantsModule {}
