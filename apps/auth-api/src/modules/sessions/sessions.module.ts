import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthSessionEntity } from '@app/database';
import { SessionsController } from './sessions.controller.js';
import { SessionsService } from './sessions.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([AuthSessionEntity])],
  controllers: [SessionsController],
  providers: [SessionsService],
})
export class SessionsModule {}
