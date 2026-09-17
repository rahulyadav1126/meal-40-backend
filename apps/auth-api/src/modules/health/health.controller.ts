import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { Public } from '@app/auth';
@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}
  @Get() async check() {
    await this.dataSource.query('SELECT 1');
    return { application: 'up', database: 'up' };
  }
}
