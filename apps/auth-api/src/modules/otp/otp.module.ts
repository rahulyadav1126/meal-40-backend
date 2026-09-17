import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpCodeEntity } from '@app/database';
import { OtpController } from './otp.controller.js';
import { OtpService } from './otp.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([OtpCodeEntity])],
  controllers: [OtpController],
  providers: [OtpService],
})
export class OtpModule {}
