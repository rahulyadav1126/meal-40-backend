import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CartEntity, CartItemEntity, MenuItemEntity } from '@app/database';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
@Module({
  imports: [
    TypeOrmModule.forFeature([CartEntity, CartItemEntity, MenuItemEntity]),
  ],
  controllers: [CartController],
  providers: [CartService],
})
export class CartModule {}
