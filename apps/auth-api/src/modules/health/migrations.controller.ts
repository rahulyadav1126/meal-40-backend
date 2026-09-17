import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '@app/auth';
import { UserRole } from '@app/contracts';
import { MigrationTrackingService } from '@app/database';

@ApiBearerAuth()
@ApiTags('Health')
@Roles(UserRole.ADMIN)
@Controller('health/migrations')
export class MigrationsController {
  constructor(private readonly migrations: MigrationTrackingService) {}
  @Get() status() {
    return this.migrations.getStatus();
  }
}
