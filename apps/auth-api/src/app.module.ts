import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthSharedModule, JwtAuthGuard, RolesGuard } from '@app/auth';
import { Plate40ConfigModule } from '@app/config';
import { DatabaseModule } from '@app/database';
import { Plate40LoggerModule } from '@app/common';
import { AuthenticationModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { OtpModule } from './modules/otp/otp.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';

@Module({
  imports: [
    Plate40ConfigModule.forRoot(['.env.auth', '.env']),
    Plate40LoggerModule,
    DatabaseModule,
    AuthSharedModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    AuthenticationModule,
    SessionsModule,
    OtpModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
