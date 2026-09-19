import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuItemEntity, RestaurantEntity } from '@app/database';
import { CloudinaryFileStorageProvider } from '@app/integrations';
import { RestaurantsModule } from '../restaurants/restaurants.module.js';
import {
  MerchantMenuController,
  PublicMenuController,
} from './menu.controller.js';
import { MenuService } from './menu.service.js';
@Module({
  imports: [
    TypeOrmModule.forFeature([MenuItemEntity, RestaurantEntity]),
    RestaurantsModule,
  ],
  controllers: [PublicMenuController, MerchantMenuController],
  providers: [MenuService, CloudinaryFileStorageProvider],
})
export class MenuModule {}
