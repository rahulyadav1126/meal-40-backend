import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { hash, verify } from 'argon2';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ErrorCode, OtpPurpose } from '@app/contracts';
import { DomainException } from '@app/common';
import { OtpCodeEntity } from '@app/database';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpCodeEntity)
    private readonly codes: Repository<OtpCodeEntity>,
    private readonly config: ConfigService,
  ) {}
  async create(identifier: string, purpose: OtpPurpose): Promise<void> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const ttl = this.config.getOrThrow<number>('otp.ttlMinutes');
    await this.codes.save(
      this.codes.create({
        identifier: identifier.toLowerCase(),
        purpose,
        codeHash: await hash(code),
        expiresAt: new Date(Date.now() + ttl * 60_000),
        attemptCount: 0,
        usedAt: null,
      }),
    );
    // A notification provider receives `code`; it is deliberately never logged or returned by the API.
  }
  async verify(
    identifier: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const record = await this.codes
      .createQueryBuilder('otp')
      .addSelect('otp.codeHash')
      .where({
        identifier: identifier.toLowerCase(),
        purpose,
        usedAt: IsNull(),
      })
      .orderBy('otp.createdAt', 'DESC')
      .getOne();
    if (!record)
      throw new DomainException(ErrorCode.OTP_INVALID, 'Invalid OTP');
    if (record.expiresAt <= new Date())
      throw new DomainException(ErrorCode.OTP_EXPIRED, 'OTP expired');
    const maxAttempts = this.config.getOrThrow<number>('otp.maxAttempts');
    if (record.attemptCount >= maxAttempts)
      throw new DomainException(
        ErrorCode.OTP_ATTEMPTS_EXCEEDED,
        'OTP attempt limit exceeded',
      );
    record.attemptCount += 1;
    if (!(await verify(record.codeHash, code))) {
      await this.codes.save(record);
      throw new DomainException(ErrorCode.OTP_INVALID, 'Invalid OTP');
    }
    record.usedAt = new Date();
    await this.codes.save(record);
  }
  @Cron(CronExpression.EVERY_HOUR) async cleanupExpired(): Promise<void> {
    await this.codes.delete({ expiresAt: LessThan(new Date()) });
  }
}
