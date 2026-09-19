import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DATABASE_TABLE as T,
  NotificationType,
} from '../../../contracts/src/index.js';

const values = (source: object) =>
  Object.values(source)
    .map((value) => `'${value}'`)
    .join(',');

export class AddDeliveryNotificationTypes1789703000000 implements MigrationInterface {
  name = 'AddDeliveryNotificationTypes1789703000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`${T.NOTIFICATIONS}\` MODIFY \`type\` enum(${values(NotificationType)}) NOT NULL`,
    );
  }

  async down(): Promise<void> {
    // Delivery OTP records may exist, so narrowing this enum automatically is unsafe.
  }
}
