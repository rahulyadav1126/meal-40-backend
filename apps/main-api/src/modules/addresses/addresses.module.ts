import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressEntity } from '@app/database';
import { AddressesController } from './addresses.controller.js';
import { AddressesService } from './addresses.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([AddressEntity])],
  controllers: [AddressesController],
  providers: [AddressesService],
})
export class AddressesModule {}
