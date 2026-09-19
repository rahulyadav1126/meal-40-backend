import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  DATABASE_TABLE as T,
  DeliveryDocumentType,
  DeliveryPartnerApprovalStatus,
  DeliveryStatus,
  OrderStatus,
  UserRole,
  VehicleType,
  VerificationStatus,
} from '../../../contracts/src/index.js';

const values = (source: object) =>
  Object.values(source)
    .map((value) => `'${value}'`)
    .join(',');
const timestamps =
  '`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)';

export class AddDeliveryPartners1789702000000 implements MigrationInterface {
  name = 'AddDeliveryPartners1789702000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`${T.USERS}\` MODIFY \`role\` enum(${values(UserRole)}) NOT NULL DEFAULT '${UserRole.CUSTOMER}'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`${T.ORDERS}\` MODIFY \`order_status\` enum(${values(OrderStatus)}) NOT NULL DEFAULT '${OrderStatus.PENDING}'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`${T.ORDER_STATUS_HISTORY}\` MODIFY \`old_status\` enum(${values(OrderStatus)}) NULL, MODIFY \`new_status\` enum(${values(OrderStatus)}) NOT NULL`,
    );

    await queryRunner.query(`CREATE TABLE \`${T.DELIVERY_PARTNERS}\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`user_id\` bigint unsigned NOT NULL,
      \`profile_photo_url\` varchar(500) NULL,
      \`address\` varchar(500) NOT NULL,
      \`vehicle_type\` enum(${values(VehicleType)}) NOT NULL,
      \`vehicle_number\` varchar(30) NOT NULL,
      \`approval_status\` enum(${values(DeliveryPartnerApprovalStatus)}) NOT NULL DEFAULT '${DeliveryPartnerApprovalStatus.PENDING}',
      \`is_online\` tinyint(1) NOT NULL DEFAULT 0,
      \`approved_at\` datetime NULL,
      ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_delivery_partners_user\` (\`user_id\`),
      KEY \`idx_delivery_partners_dispatch\` (\`approval_status\`, \`is_online\`),
      CONSTRAINT \`fk_delivery_partners_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`${T.USERS}\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE \`${T.DELIVERY_PARTNER_DOCUMENTS}\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`delivery_partner_id\` bigint unsigned NOT NULL,
      \`type\` enum(${values(DeliveryDocumentType)}) NOT NULL,
      \`document_number\` varchar(100) NOT NULL,
      \`document_url\` varchar(500) NULL,
      \`status\` enum(${values(VerificationStatus)}) NOT NULL DEFAULT '${VerificationStatus.PENDING}',
      \`verified_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`),
      KEY \`idx_delivery_documents_partner\` (\`delivery_partner_id\`),
      CONSTRAINT \`fk_delivery_documents_partner\` FOREIGN KEY (\`delivery_partner_id\`) REFERENCES \`${T.DELIVERY_PARTNERS}\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE \`${T.DELIVERIES}\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
      \`order_id\` bigint unsigned NOT NULL,
      \`delivery_partner_id\` bigint unsigned NULL,
      \`status\` enum(${values(DeliveryStatus)}) NOT NULL DEFAULT '${DeliveryStatus.AVAILABLE}',
      \`distance_km\` decimal(8,2) NOT NULL, \`delivery_fee\` decimal(10,2) NOT NULL,
      \`estimated_minutes\` int unsigned NOT NULL, \`rejected_partner_ids\` json NULL,
      \`otp_hash\` varchar(255) NULL, \`otp_expires_at\` datetime NULL, \`otp_attempts\` int unsigned NOT NULL DEFAULT 0,
      \`assigned_at\` datetime NULL, \`arrived_merchant_at\` datetime NULL, \`picked_up_at\` datetime NULL,
      \`out_for_delivery_at\` datetime NULL, \`arrived_customer_at\` datetime NULL, \`delivered_at\` datetime NULL,
      ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_deliveries_order\` (\`order_id\`),
      KEY \`idx_deliveries_partner_status\` (\`delivery_partner_id\`, \`status\`),
      CONSTRAINT \`fk_deliveries_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`${T.ORDERS}\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_deliveries_partner\` FOREIGN KEY (\`delivery_partner_id\`) REFERENCES \`${T.DELIVERY_PARTNERS}\` (\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB`);
    await queryRunner.query(`CREATE TABLE \`${T.DELIVERY_EARNINGS}\` (
      \`id\` bigint unsigned NOT NULL AUTO_INCREMENT, \`delivery_id\` bigint unsigned NOT NULL,
      \`delivery_partner_id\` bigint unsigned NOT NULL, \`base_amount\` decimal(10,2) NOT NULL,
      \`distance_amount\` decimal(10,2) NOT NULL, \`tip_amount\` decimal(10,2) NOT NULL DEFAULT 0,
      \`total_amount\` decimal(10,2) NOT NULL, ${timestamps}, PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_delivery_earnings_delivery\` (\`delivery_id\`),
      KEY \`idx_delivery_earnings_partner_created\` (\`delivery_partner_id\`, \`created_at\`),
      CONSTRAINT \`fk_delivery_earnings_delivery\` FOREIGN KEY (\`delivery_id\`) REFERENCES \`${T.DELIVERIES}\` (\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`fk_delivery_earnings_partner\` FOREIGN KEY (\`delivery_partner_id\`) REFERENCES \`${T.DELIVERY_PARTNERS}\` (\`id\`) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`${T.DELIVERY_EARNINGS}\``);
    await queryRunner.query(`DROP TABLE \`${T.DELIVERIES}\``);
    await queryRunner.query(`DROP TABLE \`${T.DELIVERY_PARTNER_DOCUMENTS}\``);
    await queryRunner.query(`DROP TABLE \`${T.DELIVERY_PARTNERS}\``);
  }
}
