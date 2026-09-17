import { Injectable } from '@nestjs/common';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import {
  MIGRATION_HISTORY_TABLE,
  MIGRATION_SOURCE_DIRECTORY,
} from '../typeorm.config.js';

const MIGRATION_FILE_PATTERN = /^\d+-.*\.ts$/;
const MIGRATION_CLASS_PATTERN = /export\s+class\s+(\w+)/;

export interface AppliedMigration {
  id: number;
  timestamp: number;
  name: string;
}

export interface MigrationStatus {
  hasPendingMigrations: boolean;
  lastAppliedMigration: AppliedMigration | null;
  appliedMigrations: AppliedMigration[];
  pendingMigrations: string[];
}

@Injectable()
export class MigrationTrackingService {
  constructor(private readonly dataSource: DataSource) {}

  private async getKnownMigrationNames(): Promise<string[]> {
    const directory = join(process.cwd(), MIGRATION_SOURCE_DIRECTORY);
    const files = (await readdir(directory)).filter((file) =>
      MIGRATION_FILE_PATTERN.test(file),
    );

    return Promise.all(
      files.map(async (file) => {
        const source = await readFile(join(directory, file), 'utf8');
        return MIGRATION_CLASS_PATTERN.exec(source)?.[1] ?? file;
      }),
    );
  }

  async getStatus(): Promise<MigrationStatus> {
    const knownMigrations = await this.getKnownMigrationNames();
    const hasHistoryTable = (await this.dataSource.query(
      `SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
      [MIGRATION_HISTORY_TABLE],
    )) as Array<{ count: string | number }>;

    if (Number(hasHistoryTable[0]?.count ?? 0) === 0) {
      return {
        hasPendingMigrations: knownMigrations.length > 0,
        lastAppliedMigration: null,
        appliedMigrations: [],
        pendingMigrations: knownMigrations,
      };
    }

    const appliedMigrations = (await this.dataSource.query(
      `SELECT id, timestamp, name FROM \`${MIGRATION_HISTORY_TABLE}\` ORDER BY id DESC`,
    )) as AppliedMigration[];
    const appliedNames = new Set(
      appliedMigrations.map((migration) => migration.name),
    );
    const pendingMigrations = knownMigrations.filter(
      (migration) => !appliedNames.has(migration),
    );

    return {
      hasPendingMigrations: pendingMigrations.length > 0,
      lastAppliedMigration: appliedMigrations[0] ?? null,
      appliedMigrations,
      pendingMigrations,
    };
  }
}
