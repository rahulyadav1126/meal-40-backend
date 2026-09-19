import type { MigrationInterface, QueryRunner } from 'typeorm';
import { DATABASE_TABLE as T } from '../../../contracts/src/index.js';

const categories = [
  ['Starters', 'starters', 'Appetisers and small plates', 10],
  ['Main Course', 'main-course', 'Curries, gravies and signature mains', 20],
  ['Breads', 'breads', 'Roti, naan, paratha and other breads', 30],
  ['Rice & Biryani', 'rice-biryani', 'Rice dishes, pulao and biryani', 40],
  [
    'Thalis & Combos',
    'thalis-combos',
    'Complete meals and value combinations',
    50,
  ],
  ['South Indian', 'south-indian', 'Dosa, idli and regional favourites', 60],
  ['Chinese', 'chinese', 'Indo-Chinese dishes and noodles', 70],
  ['Snacks', 'snacks', 'Quick bites and street-food favourites', 80],
  ['Desserts', 'desserts', 'Sweets, cakes and ice cream', 90],
  ['Beverages', 'beverages', 'Hot and cold drinks', 100],
] as const;

export class SeedMenuCategories1789701000000 implements MigrationInterface {
  name = 'SeedMenuCategories1789701000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [name, slug, description, displayOrder] of categories) {
      await queryRunner.query(
        `INSERT INTO \`${T.CATEGORIES}\` (\`name\`, \`slug\`, \`description\`, \`image_url\`, \`display_order\`, \`is_active\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, NULL, ?, 1, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
         ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`description\` = VALUES(\`description\`), \`display_order\` = VALUES(\`display_order\`), \`is_active\` = 1`,
        [name, slug, description, displayOrder],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM \`${T.CATEGORIES}\` WHERE \`slug\` IN (${categories.map(() => '?').join(', ')})`,
      categories.map(([, slug]) => slug),
    );
  }
}
