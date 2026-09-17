import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.CATEGORIES)
export class CategoryEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 160, unique: true }) slug: string;
  @Column({ type: 'text', nullable: true }) description: string | null;
  @Column({ name: 'image_url', type: 'varchar', length: 500, nullable: true })
  imageUrl: string | null;
  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;
  @Column({ name: 'is_active', default: true }) isActive: boolean;
}
