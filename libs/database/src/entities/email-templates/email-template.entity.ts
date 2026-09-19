import { DATABASE_TABLE } from '../../../../contracts/src/index.js';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.EMAIL_TEMPLATES)
@Index(
  'uq_email_templates_key_locale_version',
  ['templateKey', 'locale', 'version'],
  {
    unique: true,
  },
)
@Index('idx_email_templates_lookup', ['templateKey', 'locale', 'isActive'])
export class EmailTemplateEntity extends BaseEntity {
  @Column({ name: 'template_key', type: 'varchar', length: 100 })
  templateKey: string;

  @Column({ type: 'varchar', length: 10, default: 'en' }) locale: string;

  @Column({ name: 'subject_template', type: 'text' }) subjectTemplate: string;

  @Column({ name: 'html_body', type: 'longtext' }) htmlBody: string;

  @Column({ name: 'text_body', type: 'longtext' }) textBody: string;

  @Column({ name: 'required_variables', type: 'json' })
  requiredVariables: string[];

  @Column({
    name: 'provider_template_id',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  providerTemplateId: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', unsigned: true, default: 1 }) version: number;
}
