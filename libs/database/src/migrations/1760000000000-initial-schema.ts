import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  AddressLabel,
  AuditAction,
  AuditEntityType,
  DATABASE_TABLE as T,
  DayOfWeek,
  DiscountType,
  DocumentType,
  FoodType,
  JobStatus,
  NotificationType,
  OrderStatus,
  OtpPurpose,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  RestaurantApprovalStatus,
  RestaurantOpeningStatus,
  UserRole,
  UserStatus,
  VerificationStatus,
  WebhookStatus,
} from '../../../contracts/src/index.js';

const values = (enumeration: Record<string, string>) =>
  Object.values(enumeration)
    .map((value) => `'${value}'`)
    .join(',');
const timestamps =
  '`created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)';
const id = '`id` bigint unsigned NOT NULL AUTO_INCREMENT';

export class InitialSchema1760000000000 implements MigrationInterface {
  name = 'InitialSchema1760000000000';
  public async up(queryRunner: QueryRunner): Promise<void> {
    const statements = [
      `CREATE TABLE \`${T.USERS}\` (${id}, \`uuid\` char(36) NOT NULL, \`name\` varchar(120) NOT NULL, \`email\` varchar(191) NULL, \`phone\` varchar(20) NULL, \`password_hash\` varchar(255) NOT NULL, \`role\` enum(${values(UserRole)}) NOT NULL DEFAULT '${UserRole.CUSTOMER}', \`status\` enum(${values(UserStatus)}) NOT NULL DEFAULT '${UserStatus.ACTIVE}', \`email_verified_at\` datetime NULL, \`phone_verified_at\` datetime NULL, \`last_login_at\` datetime NULL, ${timestamps}, \`deleted_at\` datetime(6) NULL, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_users_uuid\` (\`uuid\`), UNIQUE KEY \`uq_users_email\` (\`email\`), UNIQUE KEY \`uq_users_phone\` (\`phone\`)) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.AUTH_SESSIONS}\` (${id}, \`user_id\` bigint unsigned NOT NULL, \`refresh_token_hash\` varchar(255) NOT NULL, \`device_name\` varchar(120) NULL, \`ip_address\` varchar(45) NULL, \`user_agent\` varchar(500) NULL, \`expires_at\` datetime NOT NULL, \`revoked_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_sessions_user_revoked\` (\`user_id\`,\`revoked_at\`), CONSTRAINT \`fk_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.OTP_CODES}\` (${id}, \`identifier\` varchar(191) NOT NULL, \`purpose\` enum(${values(OtpPurpose)}) NOT NULL, \`code_hash\` varchar(255) NOT NULL, \`expires_at\` datetime NOT NULL, \`attempt_count\` smallint unsigned NOT NULL DEFAULT 0, \`used_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_otp_identifier_purpose\` (\`identifier\`,\`purpose\`)) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.ADDRESSES}\` (${id}, \`user_id\` bigint unsigned NOT NULL, \`label\` enum(${values(AddressLabel)}) NOT NULL DEFAULT '${AddressLabel.HOME}', \`recipient_name\` varchar(120) NOT NULL, \`phone\` varchar(20) NOT NULL, \`address_line_1\` varchar(255) NOT NULL, \`address_line_2\` varchar(255) NULL, \`landmark\` varchar(120) NULL, \`city\` varchar(100) NOT NULL, \`state\` varchar(100) NOT NULL, \`postal_code\` varchar(20) NOT NULL, \`country\` varchar(2) NOT NULL DEFAULT 'IN', \`latitude\` decimal(10,7) NOT NULL, \`longitude\` decimal(10,7) NOT NULL, \`is_default\` tinyint NOT NULL DEFAULT 0, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_addresses_user\` (\`user_id\`), CONSTRAINT \`fk_addresses_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.RESTAURANTS}\` (${id}, \`uuid\` char(36) NOT NULL, \`merchant_id\` bigint unsigned NOT NULL, \`name\` varchar(160) NOT NULL, \`slug\` varchar(191) NOT NULL, \`description\` text NULL, \`phone\` varchar(20) NOT NULL, \`email\` varchar(191) NULL, \`logo_url\` varchar(500) NULL, \`cover_image_url\` varchar(500) NULL, \`address_line_1\` varchar(255) NOT NULL, \`address_line_2\` varchar(255) NULL, \`city\` varchar(100) NOT NULL, \`state\` varchar(100) NOT NULL, \`postal_code\` varchar(20) NOT NULL, \`country\` varchar(2) NOT NULL DEFAULT 'IN', \`latitude\` decimal(10,7) NOT NULL, \`longitude\` decimal(10,7) NOT NULL, \`delivery_radius_km\` decimal(6,2) NOT NULL, \`minimum_order_amount\` decimal(10,2) NOT NULL DEFAULT 0, \`opening_status\` enum(${values(RestaurantOpeningStatus)}) NOT NULL DEFAULT '${RestaurantOpeningStatus.CLOSED}', \`approval_status\` enum(${values(RestaurantApprovalStatus)}) NOT NULL DEFAULT '${RestaurantApprovalStatus.PENDING}', \`average_rating\` decimal(3,2) NOT NULL DEFAULT 0, \`rating_count\` int unsigned NOT NULL DEFAULT 0, \`is_active\` tinyint NOT NULL DEFAULT 1, ${timestamps}, \`deleted_at\` datetime(6) NULL, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_restaurants_uuid\` (\`uuid\`), UNIQUE KEY \`uq_restaurants_slug\` (\`slug\`), KEY \`idx_restaurants_merchant\` (\`merchant_id\`), KEY \`idx_restaurants_approval_active\` (\`approval_status\`,\`is_active\`), CONSTRAINT \`fk_restaurants_merchant\` FOREIGN KEY (\`merchant_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.RESTAURANT_DOCUMENTS}\` (${id}, \`restaurant_id\` bigint unsigned NOT NULL, \`document_type\` enum(${values(DocumentType)}) NOT NULL, \`document_number\` varchar(120) NULL, \`file_url\` varchar(500) NOT NULL, \`verification_status\` enum(${values(VerificationStatus)}) NOT NULL DEFAULT '${VerificationStatus.PENDING}', \`rejection_reason\` varchar(500) NULL, \`verified_by\` bigint unsigned NULL, \`verified_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_restaurant_documents_restaurant\` (\`restaurant_id\`), CONSTRAINT \`fk_restaurant_documents_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`${T.RESTAURANTS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.RESTAURANT_OPERATING_HOURS}\` (${id}, \`restaurant_id\` bigint unsigned NOT NULL, \`day_of_week\` enum(${values(DayOfWeek)}) NOT NULL, \`opening_time\` time NULL, \`closing_time\` time NULL, \`is_closed\` tinyint NOT NULL DEFAULT 0, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_restaurant_day\` (\`restaurant_id\`,\`day_of_week\`), CONSTRAINT \`fk_hours_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`${T.RESTAURANTS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.CATEGORIES}\` (${id}, \`name\` varchar(120) NOT NULL, \`slug\` varchar(160) NOT NULL, \`description\` text NULL, \`image_url\` varchar(500) NULL, \`display_order\` int NOT NULL DEFAULT 0, \`is_active\` tinyint NOT NULL DEFAULT 1, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_categories_slug\` (\`slug\`)) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.MENU_ITEMS}\` (${id}, \`uuid\` char(36) NOT NULL, \`restaurant_id\` bigint unsigned NOT NULL, \`category_id\` bigint unsigned NOT NULL, \`name\` varchar(160) NOT NULL, \`slug\` varchar(191) NOT NULL, \`description\` text NULL, \`image_url\` varchar(500) NULL, \`food_type\` enum(${values(FoodType)}) NOT NULL, \`price\` decimal(10,2) NOT NULL, \`discounted_price\` decimal(10,2) NULL, \`is_available\` tinyint NOT NULL DEFAULT 1, \`is_featured\` tinyint NOT NULL DEFAULT 0, \`preparation_time_minutes\` smallint unsigned NOT NULL, \`display_order\` int NOT NULL DEFAULT 0, ${timestamps}, \`deleted_at\` datetime(6) NULL, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_menu_uuid\` (\`uuid\`), UNIQUE KEY \`uq_menu_restaurant_slug\` (\`restaurant_id\`,\`slug\`), KEY \`idx_menu_category\` (\`category_id\`), KEY \`idx_menu_restaurant_available\` (\`restaurant_id\`,\`is_available\`), CONSTRAINT \`fk_menu_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`${T.RESTAURANTS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_menu_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`${T.CATEGORIES}\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.CARTS}\` (${id}, \`user_id\` bigint unsigned NOT NULL, \`restaurant_id\` bigint unsigned NOT NULL, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_cart_user_restaurant\` (\`user_id\`,\`restaurant_id\`), CONSTRAINT \`fk_cart_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE CASCADE, CONSTRAINT \`fk_cart_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`${T.RESTAURANTS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.CART_ITEMS}\` (${id}, \`cart_id\` bigint unsigned NOT NULL, \`menu_item_id\` bigint unsigned NOT NULL, \`quantity\` smallint unsigned NOT NULL, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_cart_menu_item\` (\`cart_id\`,\`menu_item_id\`), CONSTRAINT \`fk_cart_item_cart\` FOREIGN KEY (\`cart_id\`) REFERENCES \`${T.CARTS}\`(\`id\`) ON DELETE CASCADE, CONSTRAINT \`fk_cart_item_menu\` FOREIGN KEY (\`menu_item_id\`) REFERENCES \`${T.MENU_ITEMS}\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.COUPONS}\` (${id}, \`code\` varchar(50) NOT NULL, \`description\` varchar(500) NULL, \`discount_type\` enum(${values(DiscountType)}) NOT NULL, \`discount_value\` decimal(10,2) NOT NULL, \`maximum_discount\` decimal(10,2) NULL, \`minimum_order_amount\` decimal(10,2) NOT NULL DEFAULT 0, \`start_at\` datetime NOT NULL, \`expires_at\` datetime NOT NULL, \`total_usage_limit\` int unsigned NULL, \`per_user_usage_limit\` int unsigned NOT NULL DEFAULT 1, \`is_active\` tinyint NOT NULL DEFAULT 1, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_coupons_code\` (\`code\`), KEY \`idx_coupons_active_dates\` (\`is_active\`,\`start_at\`,\`expires_at\`)) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.ORDERS}\` (${id}, \`uuid\` char(36) NOT NULL, \`order_number\` varchar(40) NOT NULL, \`customer_id\` bigint unsigned NOT NULL, \`restaurant_id\` bigint unsigned NOT NULL, \`address_id\` bigint unsigned NOT NULL, \`coupon_id\` bigint unsigned NULL, \`subtotal\` decimal(10,2) NOT NULL, \`discount_amount\` decimal(10,2) NOT NULL DEFAULT 0, \`delivery_fee\` decimal(10,2) NOT NULL DEFAULT 0, \`platform_fee\` decimal(10,2) NOT NULL DEFAULT 0, \`tax_amount\` decimal(10,2) NOT NULL DEFAULT 0, \`total_amount\` decimal(10,2) NOT NULL, \`payment_method\` enum(${values(PaymentMethod)}) NOT NULL, \`payment_status\` enum(${values(PaymentStatus)}) NOT NULL DEFAULT '${PaymentStatus.PENDING}', \`order_status\` enum(${values(OrderStatus)}) NOT NULL DEFAULT '${OrderStatus.PENDING}', \`customer_note\` varchar(500) NULL, \`cancellation_reason\` varchar(500) NULL, \`accepted_at\` datetime NULL, \`preparing_at\` datetime NULL, \`ready_at\` datetime NULL, \`out_for_delivery_at\` datetime NULL, \`delivered_at\` datetime NULL, \`cancelled_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_orders_uuid\` (\`uuid\`), UNIQUE KEY \`uq_orders_number\` (\`order_number\`), KEY \`idx_orders_customer_created\` (\`customer_id\`,\`created_at\`), KEY \`idx_orders_restaurant_status\` (\`restaurant_id\`,\`order_status\`), CONSTRAINT \`fk_orders_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_orders_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`${T.RESTAURANTS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_orders_address\` FOREIGN KEY (\`address_id\`) REFERENCES \`${T.ADDRESSES}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_orders_coupon\` FOREIGN KEY (\`coupon_id\`) REFERENCES \`${T.COUPONS}\`(\`id\`) ON DELETE SET NULL) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.ORDER_ITEMS}\` (${id}, \`order_id\` bigint unsigned NOT NULL, \`menu_item_id\` bigint unsigned NULL, \`item_name\` varchar(160) NOT NULL, \`item_description\` text NULL, \`item_image_url\` varchar(500) NULL, \`unit_price\` decimal(10,2) NOT NULL, \`quantity\` smallint unsigned NOT NULL, \`total_price\` decimal(10,2) NOT NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_order_items_order\` (\`order_id\`), CONSTRAINT \`fk_order_items_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`${T.ORDERS}\`(\`id\`) ON DELETE CASCADE, CONSTRAINT \`fk_order_items_menu\` FOREIGN KEY (\`menu_item_id\`) REFERENCES \`${T.MENU_ITEMS}\`(\`id\`) ON DELETE SET NULL) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.ORDER_STATUS_HISTORY}\` (${id}, \`order_id\` bigint unsigned NOT NULL, \`old_status\` enum(${values(OrderStatus)}) NULL, \`new_status\` enum(${values(OrderStatus)}) NOT NULL, \`changed_by_user_id\` bigint unsigned NULL, \`note\` varchar(500) NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_order_history_order\` (\`order_id\`,\`created_at\`), CONSTRAINT \`fk_history_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`${T.ORDERS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.PAYMENTS}\` (${id}, \`order_id\` bigint unsigned NOT NULL, \`provider\` enum(${values(PaymentProvider)}) NOT NULL, \`provider_order_id\` varchar(191) NULL, \`provider_payment_id\` varchar(191) NULL, \`provider_signature\` varchar(255) NULL, \`amount\` decimal(10,2) NOT NULL, \`currency\` varchar(3) NOT NULL DEFAULT 'INR', \`status\` enum(${values(PaymentStatus)}) NOT NULL DEFAULT '${PaymentStatus.PENDING}', \`payment_method\` enum(${values(PaymentMethod)}) NOT NULL, \`paid_at\` datetime NULL, \`failed_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_payments_order\` (\`order_id\`), KEY \`idx_payments_provider_order\` (\`provider_order_id\`), CONSTRAINT \`fk_payments_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`${T.ORDERS}\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.WEBHOOK_EVENTS}\` (${id}, \`provider\` enum(${values(PaymentProvider)}) NOT NULL, \`event_id\` varchar(191) NOT NULL, \`event_type\` varchar(120) NOT NULL, \`payload\` json NOT NULL, \`processed_at\` datetime NULL, \`status\` enum(${values(WebhookStatus)}) NOT NULL DEFAULT '${WebhookStatus.PENDING}', ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_webhook_provider_event\` (\`provider\`,\`event_id\`)) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.COUPON_USAGES}\` (${id}, \`coupon_id\` bigint unsigned NOT NULL, \`user_id\` bigint unsigned NOT NULL, \`order_id\` bigint unsigned NOT NULL, \`discount_amount\` decimal(10,2) NOT NULL, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_coupon_order\` (\`coupon_id\`,\`order_id\`), CONSTRAINT \`fk_coupon_usage_coupon\` FOREIGN KEY (\`coupon_id\`) REFERENCES \`${T.COUPONS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_coupon_usage_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_coupon_usage_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`${T.ORDERS}\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.REVIEWS}\` (${id}, \`customer_id\` bigint unsigned NOT NULL, \`restaurant_id\` bigint unsigned NOT NULL, \`order_id\` bigint unsigned NOT NULL, \`rating\` tinyint unsigned NOT NULL, \`comment\` text NULL, \`is_visible\` tinyint NOT NULL DEFAULT 1, ${timestamps}, PRIMARY KEY (\`id\`), UNIQUE KEY \`uq_reviews_order\` (\`order_id\`), CONSTRAINT \`chk_reviews_rating\` CHECK (\`rating\` BETWEEN 1 AND 5), CONSTRAINT \`fk_reviews_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_reviews_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`${T.RESTAURANTS}\`(\`id\`) ON DELETE RESTRICT, CONSTRAINT \`fk_reviews_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`${T.ORDERS}\`(\`id\`) ON DELETE RESTRICT) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.NOTIFICATIONS}\` (${id}, \`user_id\` bigint unsigned NOT NULL, \`type\` enum(${values(NotificationType)}) NOT NULL, \`title\` varchar(160) NOT NULL, \`message\` text NOT NULL, \`data_json\` json NULL, \`is_read\` tinyint NOT NULL DEFAULT 0, \`read_at\` datetime NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_notifications_user_read\` (\`user_id\`,\`is_read\`), CONSTRAINT \`fk_notifications_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`${T.USERS}\`(\`id\`) ON DELETE CASCADE) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.BACKGROUND_JOBS}\` (${id}, \`type\` varchar(120) NOT NULL, \`payload_json\` json NOT NULL, \`status\` enum(${values(JobStatus)}) NOT NULL DEFAULT '${JobStatus.PENDING}', \`attempts\` smallint unsigned NOT NULL DEFAULT 0, \`max_attempts\` smallint unsigned NOT NULL DEFAULT 3, \`available_at\` datetime NOT NULL, \`started_at\` datetime NULL, \`completed_at\` datetime NULL, \`failed_at\` datetime NULL, \`error_message\` text NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_jobs_status_available\` (\`status\`,\`available_at\`)) ENGINE=InnoDB`,
      `CREATE TABLE \`${T.AUDIT_LOGS}\` (${id}, \`actor_user_id\` bigint unsigned NULL, \`action\` enum(${values(AuditAction)}) NOT NULL, \`entity_type\` enum(${values(AuditEntityType)}) NOT NULL, \`entity_id\` varchar(120) NOT NULL, \`old_values_json\` json NULL, \`new_values_json\` json NULL, \`ip_address\` varchar(45) NULL, ${timestamps}, PRIMARY KEY (\`id\`), KEY \`idx_audit_entity\` (\`entity_type\`,\`entity_id\`)) ENGINE=InnoDB`,
    ];
    for (const statement of statements) await queryRunner.query(statement);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      T.AUDIT_LOGS,
      T.BACKGROUND_JOBS,
      T.NOTIFICATIONS,
      T.REVIEWS,
      T.COUPON_USAGES,
      T.WEBHOOK_EVENTS,
      T.PAYMENTS,
      T.ORDER_STATUS_HISTORY,
      T.ORDER_ITEMS,
      T.ORDERS,
      T.COUPONS,
      T.CART_ITEMS,
      T.CARTS,
      T.MENU_ITEMS,
      T.CATEGORIES,
      T.RESTAURANT_OPERATING_HOURS,
      T.RESTAURANT_DOCUMENTS,
      T.RESTAURANTS,
      T.ADDRESSES,
      T.OTP_CODES,
      T.AUTH_SESSIONS,
      T.USERS,
    ];
    for (const table of tables)
      await queryRunner.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
}
