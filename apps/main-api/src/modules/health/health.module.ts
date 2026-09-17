import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { MigrationsController } from './migrations.controller.js';
@Module({ controllers: [HealthController, MigrationsController] })
export class HealthModule {}
