import { MigrationInterface, QueryRunner } from "typeorm";

export class AutoMigration1789557568057 implements MigrationInterface {
    name = 'AutoMigration1789557568057'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`addresses\` DROP FOREIGN KEY \`fk_addresses_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`auth_sessions\` DROP FOREIGN KEY \`fk_sessions_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\` DROP FOREIGN KEY \`fk_restaurants_merchant\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\` DROP FOREIGN KEY \`fk_cart_restaurant\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\` DROP FOREIGN KEY \`fk_cart_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\` DROP FOREIGN KEY \`fk_menu_category\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\` DROP FOREIGN KEY \`fk_menu_restaurant\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`fk_cart_item_cart\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`fk_cart_item_menu\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`fk_orders_address\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`fk_orders_coupon\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`fk_orders_customer\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`fk_orders_restaurant\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\` DROP FOREIGN KEY \`fk_coupon_usage_coupon\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\` DROP FOREIGN KEY \`fk_coupon_usage_order\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\` DROP FOREIGN KEY \`fk_coupon_usage_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`notifications\` DROP FOREIGN KEY \`fk_notifications_user\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\` DROP FOREIGN KEY \`fk_order_items_menu\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\` DROP FOREIGN KEY \`fk_order_items_order\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_status_history\` DROP FOREIGN KEY \`fk_history_order\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`payments\` DROP FOREIGN KEY \`fk_payments_order\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_documents\` DROP FOREIGN KEY \`fk_restaurant_documents_restaurant\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_operating_hours\` DROP FOREIGN KEY \`fk_hours_restaurant\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\` DROP FOREIGN KEY \`fk_reviews_customer\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\` DROP FOREIGN KEY \`fk_reviews_order\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\` DROP FOREIGN KEY \`fk_reviews_restaurant\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_users_uuid\` ON \`users\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_restaurants_slug\` ON \`restaurants\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_restaurants_uuid\` ON \`restaurants\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_categories_slug\` ON \`categories\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_menu_uuid\` ON \`menu_items\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_coupons_code\` ON \`coupons\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_orders_number\` ON \`orders\`
        `);
        await queryRunner.query(`
            DROP INDEX \`uq_orders_uuid\` ON \`orders\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`users\`
            ADD \`isActive\` tinyint NOT NULL DEFAULT 1
        `);
        await queryRunner.query(`
            ALTER TABLE \`users\`
            ADD UNIQUE INDEX \`IDX_951b8f1dfc94ac1d0301a14b7e\` (\`uuid\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\`
            ADD UNIQUE INDEX \`IDX_091877522792bf6d75f9d3db32\` (\`uuid\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\`
            ADD UNIQUE INDEX \`IDX_afb6330c019768b4c3f9a65303\` (\`slug\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`categories\`
            ADD UNIQUE INDEX \`IDX_420d9f679d41281f282f5bc7d0\` (\`slug\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\`
            ADD UNIQUE INDEX \`IDX_b07d96452a2dd673e395327f52\` (\`uuid\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupons\`
            ADD UNIQUE INDEX \`IDX_e025109230e82925843f2a14c4\` (\`code\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD UNIQUE INDEX \`IDX_04a64e7c04376e27182f8c0fa1\` (\`uuid\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD UNIQUE INDEX \`IDX_75eba1c6b1a66b09f2a97e6927\` (\`order_number\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`addresses\`
            ADD CONSTRAINT \`FK_16aac8a9f6f9c1dd6bcb75ec023\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`auth_sessions\`
            ADD CONSTRAINT \`FK_50ccaa6440288a06f0ba693ccc6\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\`
            ADD CONSTRAINT \`FK_7134b73d9680f31afedaef27986\` FOREIGN KEY (\`merchant_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\`
            ADD CONSTRAINT \`FK_2ec1c94a977b940d85a4f498aea\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\`
            ADD CONSTRAINT \`FK_ad50548131c585e38d765bde166\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\`
            ADD CONSTRAINT \`FK_8d1ee4780bf64ae94cbf3e53705\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\`
            ADD CONSTRAINT \`FK_20cff56c44dd4fe52d5aa2b96f8\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\`
            ADD CONSTRAINT \`FK_6385a745d9e12a89b859bb25623\` FOREIGN KEY (\`cart_id\`) REFERENCES \`carts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\`
            ADD CONSTRAINT \`FK_13e501a1cd1a6b1433ded345689\` FOREIGN KEY (\`menu_item_id\`) REFERENCES \`menu_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`FK_772d0ce0473ac2ccfa26060dbe9\` FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`FK_85fdda5fcce2f397ef8f117a2c6\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`FK_d39c53244703b8534307adcd073\` FOREIGN KEY (\`address_id\`) REFERENCES \`addresses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`FK_6284f0f60e4cb96c12ff96f0f15\` FOREIGN KEY (\`coupon_id\`) REFERENCES \`coupons\`(\`id\`) ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\`
            ADD CONSTRAINT \`FK_56491a0d0010feb079b964e23b4\` FOREIGN KEY (\`coupon_id\`) REFERENCES \`coupons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\`
            ADD CONSTRAINT \`FK_579f1e1f0ccf35785bbbdebeb85\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\`
            ADD CONSTRAINT \`FK_f017af60a02209a6b045f673ca1\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`notifications\`
            ADD CONSTRAINT \`FK_9a8a82462cab47c73d25f49261f\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\`
            ADD CONSTRAINT \`FK_145532db85752b29c57d2b7b1f1\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\`
            ADD CONSTRAINT \`FK_e462517174f561ece2916701c0a\` FOREIGN KEY (\`menu_item_id\`) REFERENCES \`menu_items\`(\`id\`) ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_status_history\`
            ADD CONSTRAINT \`FK_1ca7d5228cf9dc589b60243933c\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`payments\`
            ADD CONSTRAINT \`FK_b2f7b823a21562eeca20e72b006\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_documents\`
            ADD CONSTRAINT \`FK_f5ca3ce46cfdd7dd51c2264f6ce\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_operating_hours\`
            ADD CONSTRAINT \`FK_4a7f4688687089abb7873451f55\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\`
            ADD CONSTRAINT \`FK_4dd42f48aa60ad8c0d5d5c4ea5b\` FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\`
            ADD CONSTRAINT \`FK_2269110d10df8d494b99e1381d2\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\`
            ADD CONSTRAINT \`FK_e4b0ed40bdd0f318108612c2851\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_e4b0ed40bdd0f318108612c2851\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_2269110d10df8d494b99e1381d2\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_4dd42f48aa60ad8c0d5d5c4ea5b\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_operating_hours\` DROP FOREIGN KEY \`FK_4a7f4688687089abb7873451f55\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_documents\` DROP FOREIGN KEY \`FK_f5ca3ce46cfdd7dd51c2264f6ce\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`payments\` DROP FOREIGN KEY \`FK_b2f7b823a21562eeca20e72b006\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_status_history\` DROP FOREIGN KEY \`FK_1ca7d5228cf9dc589b60243933c\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_e462517174f561ece2916701c0a\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\` DROP FOREIGN KEY \`FK_145532db85752b29c57d2b7b1f1\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`notifications\` DROP FOREIGN KEY \`FK_9a8a82462cab47c73d25f49261f\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\` DROP FOREIGN KEY \`FK_f017af60a02209a6b045f673ca1\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\` DROP FOREIGN KEY \`FK_579f1e1f0ccf35785bbbdebeb85\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\` DROP FOREIGN KEY \`FK_56491a0d0010feb079b964e23b4\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_6284f0f60e4cb96c12ff96f0f15\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_d39c53244703b8534307adcd073\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_85fdda5fcce2f397ef8f117a2c6\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP FOREIGN KEY \`FK_772d0ce0473ac2ccfa26060dbe9\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`FK_13e501a1cd1a6b1433ded345689\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\` DROP FOREIGN KEY \`FK_6385a745d9e12a89b859bb25623\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\` DROP FOREIGN KEY \`FK_20cff56c44dd4fe52d5aa2b96f8\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\` DROP FOREIGN KEY \`FK_8d1ee4780bf64ae94cbf3e53705\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\` DROP FOREIGN KEY \`FK_ad50548131c585e38d765bde166\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\` DROP FOREIGN KEY \`FK_2ec1c94a977b940d85a4f498aea\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\` DROP FOREIGN KEY \`FK_7134b73d9680f31afedaef27986\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`auth_sessions\` DROP FOREIGN KEY \`FK_50ccaa6440288a06f0ba693ccc6\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`addresses\` DROP FOREIGN KEY \`FK_16aac8a9f6f9c1dd6bcb75ec023\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP INDEX \`IDX_75eba1c6b1a66b09f2a97e6927\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\` DROP INDEX \`IDX_04a64e7c04376e27182f8c0fa1\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupons\` DROP INDEX \`IDX_e025109230e82925843f2a14c4\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\` DROP INDEX \`IDX_b07d96452a2dd673e395327f52\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`categories\` DROP INDEX \`IDX_420d9f679d41281f282f5bc7d0\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\` DROP INDEX \`IDX_afb6330c019768b4c3f9a65303\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\` DROP INDEX \`IDX_091877522792bf6d75f9d3db32\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`users\` DROP INDEX \`IDX_951b8f1dfc94ac1d0301a14b7e\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`users\` DROP COLUMN \`isActive\`
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_orders_uuid\` ON \`orders\` (\`uuid\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_orders_number\` ON \`orders\` (\`order_number\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_coupons_code\` ON \`coupons\` (\`code\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_menu_uuid\` ON \`menu_items\` (\`uuid\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_categories_slug\` ON \`categories\` (\`slug\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_restaurants_uuid\` ON \`restaurants\` (\`uuid\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_restaurants_slug\` ON \`restaurants\` (\`slug\`)
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_users_uuid\` ON \`users\` (\`uuid\`)
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\`
            ADD CONSTRAINT \`fk_reviews_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\`
            ADD CONSTRAINT \`fk_reviews_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`reviews\`
            ADD CONSTRAINT \`fk_reviews_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_operating_hours\`
            ADD CONSTRAINT \`fk_hours_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurant_documents\`
            ADD CONSTRAINT \`fk_restaurant_documents_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`payments\`
            ADD CONSTRAINT \`fk_payments_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_status_history\`
            ADD CONSTRAINT \`fk_history_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\`
            ADD CONSTRAINT \`fk_order_items_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`order_items\`
            ADD CONSTRAINT \`fk_order_items_menu\` FOREIGN KEY (\`menu_item_id\`) REFERENCES \`menu_items\`(\`id\`) ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`notifications\`
            ADD CONSTRAINT \`fk_notifications_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\`
            ADD CONSTRAINT \`fk_coupon_usage_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\`
            ADD CONSTRAINT \`fk_coupon_usage_order\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`coupon_usages\`
            ADD CONSTRAINT \`fk_coupon_usage_coupon\` FOREIGN KEY (\`coupon_id\`) REFERENCES \`coupons\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`fk_orders_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`fk_orders_customer\` FOREIGN KEY (\`customer_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`fk_orders_coupon\` FOREIGN KEY (\`coupon_id\`) REFERENCES \`coupons\`(\`id\`) ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`orders\`
            ADD CONSTRAINT \`fk_orders_address\` FOREIGN KEY (\`address_id\`) REFERENCES \`addresses\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\`
            ADD CONSTRAINT \`fk_cart_item_menu\` FOREIGN KEY (\`menu_item_id\`) REFERENCES \`menu_items\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`cart_items\`
            ADD CONSTRAINT \`fk_cart_item_cart\` FOREIGN KEY (\`cart_id\`) REFERENCES \`carts\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\`
            ADD CONSTRAINT \`fk_menu_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`menu_items\`
            ADD CONSTRAINT \`fk_menu_category\` FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\`
            ADD CONSTRAINT \`fk_cart_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`carts\`
            ADD CONSTRAINT \`fk_cart_restaurant\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`restaurants\`
            ADD CONSTRAINT \`fk_restaurants_merchant\` FOREIGN KEY (\`merchant_id\`) REFERENCES \`users\`(\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`auth_sessions\`
            ADD CONSTRAINT \`fk_sessions_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
        await queryRunner.query(`
            ALTER TABLE \`addresses\`
            ADD CONSTRAINT \`fk_addresses_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    }

}
