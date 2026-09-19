import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuthSessionEntity,
  DeliveryPartnerDocumentEntity,
  DeliveryPartnerEntity,
  EmailTemplateEntity,
  UserEntity,
} from '@app/database';
import { NodemailerEmailProvider } from '@app/integrations';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      AuthSessionEntity,
      EmailTemplateEntity,
      DeliveryPartnerEntity,
      DeliveryPartnerDocumentEntity,
    ]),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, NodemailerEmailProvider],
})
export class AuthenticationModule {}
