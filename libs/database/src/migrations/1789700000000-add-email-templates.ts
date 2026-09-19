import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DATABASE_TABLE as T } from '../../../contracts/src/index.js';

export class AddEmailTemplates1789700000000 implements MigrationInterface {
  name = 'AddEmailTemplates1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`${T.EMAIL_TEMPLATES}\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`template_key\` varchar(100) NOT NULL,
        \`locale\` varchar(10) NOT NULL DEFAULT 'en',
        \`subject_template\` text NOT NULL,
        \`html_body\` longtext NOT NULL,
        \`text_body\` longtext NOT NULL,
        \`required_variables\` json NOT NULL,
        \`provider_template_id\` varchar(191) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`version\` int unsigned NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_email_templates_key_locale_version\` (\`template_key\`, \`locale\`, \`version\`),
        KEY \`idx_email_templates_lookup\` (\`template_key\`, \`locale\`, \`is_active\`)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`${T.EMAIL_TEMPLATES}\``);
  }
}
