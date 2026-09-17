import { DATABASE_TABLE, OtpPurpose } from '../../../../contracts/src/index.js';
import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../shared/base.entity.js';

@Entity(DATABASE_TABLE.OTP_CODES)
@Index('idx_otp_identifier_purpose', ['identifier', 'purpose'])
export class OtpCodeEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 191 }) identifier: string;
  @Column({ type: 'enum', enum: OtpPurpose }) purpose: OtpPurpose;
  @Column({ name: 'code_hash', type: 'varchar', length: 255, select: false })
  codeHash: string;
  @Column({ name: 'expires_at', type: 'datetime' }) expiresAt: Date;
  @Column({
    name: 'attempt_count',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  attemptCount: number;
  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null;
}
