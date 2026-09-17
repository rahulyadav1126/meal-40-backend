import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildTypeOrmOptions } from './typeorm.config.js';
import { MigrationTrackingService } from './migrations/migration-tracking.service.js';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: buildTypeOrmOptions,
    }),
  ],
  providers: [MigrationTrackingService],
  exports: [TypeOrmModule, MigrationTrackingService],
})
export class DatabaseModule {}
