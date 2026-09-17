import { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ENTITIES } from './entities/index.js';

export const MIGRATION_HISTORY_TABLE = 'migration_history' as const;
export const MIGRATION_SOURCE_DIRECTORY =
  'libs/database/src/migrations' as const;
export const MIGRATION_GLOB = 'libs/database/src/migrations/[0-9]*-*.ts' as const;

export function buildTypeOrmOptions(
  config: ConfigService,
): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.getOrThrow<string>('database.host'),
    port: config.getOrThrow<number>('database.port'),
    username: config.getOrThrow<string>('database.username'),
    password: config.getOrThrow<string>('database.password'),
    database: config.getOrThrow<string>('database.database'),
    entities: [...ENTITIES],
    migrationsTableName: MIGRATION_HISTORY_TABLE,
    migrationsTransactionMode: 'all',
    synchronize: false,
    migrationsRun: false,
    timezone: 'Z',
    logging:
      config.get<string>('app.environment') === 'development'
        ? ['error', 'warn']
        : ['error'],
  };
}
