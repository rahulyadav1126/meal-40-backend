import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RestaurantEntity } from '@app/database';
import { RealtimeGateway } from './realtime.gateway.js';
import { OutboxWorker } from './outbox.worker.js';
@Module({
  imports: [
    JwtModule.register({}),
    TypeOrmModule.forFeature([RestaurantEntity]),
  ],
  providers: [RealtimeGateway, OutboxWorker],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}
