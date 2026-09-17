import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity, PaymentEntity } from '@app/database';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity, PaymentEntity])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
