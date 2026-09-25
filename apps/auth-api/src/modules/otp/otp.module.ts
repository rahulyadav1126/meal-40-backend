import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OtpCodeEntity } from '@app/database';
import { OtpController } from './otp.controller.js';
import { OtpService } from './otp.service.js';
import { NodemailerEmailProvider } from '@app/integrations';
@Module({
  imports: [TypeOrmModule.forFeature([OtpCodeEntity])],
  controllers: [OtpController],
  providers: [OtpService, NodemailerEmailProvider],
})
export class OtpModule {}
