import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { NodemailerEmailProvider } from '@app/integrations';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { hash, verify } from 'argon2';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ErrorCode, OtpPurpose } from '@app/contracts';
import { DomainException } from '@app/common';
import { OtpCodeEntity, UserEntity } from '@app/database';

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpCodeEntity)
    private readonly codes: Repository<OtpCodeEntity>,
    private readonly config: ConfigService,
    private readonly email: NodemailerEmailProvider,
  ) {}
  async create(identifier: string, purpose: OtpPurpose): Promise<void> {
    this.assertPurpose(purpose);
    identifier = identifier.trim().toLowerCase();
    const code = String(randomInt(100000, 1000000));
    const ttl = this.config.getOrThrow<number>('otp.ttlMinutes');
    const codeHash = await hash(code);
    const record = await this.codes.manager.transaction(async manager => {
      const user = await manager.findOne(UserEntity, { where: { email: identifier }, lock: { mode: 'pessimistic_write' } });
      if (!user || !user.isActive || user.emailVerifiedAt) return null;
      const recent = await manager.findOne(OtpCodeEntity, { where: { identifier, purpose }, order: { createdAt: 'DESC' } });
      if (recent && Date.now() - recent.createdAt.getTime() < 60000) return null;
      await manager.update(OtpCodeEntity, { identifier, purpose, usedAt: IsNull() }, { usedAt: new Date() });
      return manager.save(OtpCodeEntity, manager.create(OtpCodeEntity, {
        identifier,
        purpose,
        codeHash,
        expiresAt: new Date(Date.now() + ttl * 60_000),
        attemptCount: 0,
        usedAt: null,
      }));
    });
    if (!record) return;
    try { await this.email.send({ to: identifier, subject: 'Verify your Plate40 email', text: `Your Plate40 verification code is ${code}. It expires in ${ttl} minutes. Never share it with anyone.` }); }
    catch { await this.codes.update(record.id, { usedAt: new Date() }); throw new ServiceUnavailableException('Verification email could not be sent. Please try again later.'); }
  }
  async verify(
    identifier: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    this.assertPurpose(purpose);
    identifier = identifier.trim().toLowerCase();
    const valid = await this.codes.manager.transaction(async manager => {
    const user = await manager.findOne(UserEntity, { where: { email: identifier }, lock: { mode: 'pessimistic_write' } });
    if (!user || !user.isActive) throw new DomainException(ErrorCode.OTP_INVALID, 'Invalid OTP');
    const record = await manager.getRepository(OtpCodeEntity)
      .createQueryBuilder('otp')
      .setLock('pessimistic_write')
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
      await manager.save(record);
      return false;
    }
    record.usedAt = new Date();
    await manager.save(record);
    await manager.update(UserEntity, { email: identifier }, { emailVerifiedAt: new Date() });
    return true;
    });
    if (!valid) throw new DomainException(ErrorCode.OTP_INVALID, 'Invalid OTP');
  }
  private assertPurpose(purpose: OtpPurpose) {
    if (purpose !== OtpPurpose.EMAIL_VERIFICATION) throw new BadRequestException('This OTP purpose is not enabled. Delivery codes use the assigned delivery workflow.');
  }
  @Cron(CronExpression.EVERY_HOUR) async cleanupExpired(): Promise<void> {
    await this.codes.delete({ expiresAt: LessThan(new Date()) });
  }
}
