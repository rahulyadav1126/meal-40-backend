import { config as loadEnvironment } from 'dotenv';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities/index.js';
import { MIGRATION_HISTORY_TABLE } from './typeorm.config.js';

const environmentFile = process.env.PLATE40_ENV_FILE ?? '.env.main';
loadEnvironment({ path: environmentFile });

const options: DataSourceOptions = {
  type: 'mysql',
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT ?? 3306),
  username: process.env.MYSQL_USERNAME,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  entities: [...ENTITIES],
  migrations: ['libs/database/src/migrations/[0-9]*-*.ts'],
  migrationsTableName: MIGRATION_HISTORY_TABLE,
  migrationsTransactionMode: 'all',
  synchronize: false,
};

export default new DataSource(options);
