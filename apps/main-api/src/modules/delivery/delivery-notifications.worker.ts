import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { BackgroundJobEntity, DeliveryEntity } from '@app/database';
import { JobStatus, DeliveryStatus } from '@app/contracts';
import { DeliveryService } from './delivery.service.js';

@Injectable()
export class DeliveryNotificationsWorker {
  private busy = false;
  private readonly logger = new Logger(DeliveryNotificationsWorker.name);
  constructor(private readonly db: DataSource, private readonly delivery: DeliveryService) {}
  @Interval(3000)
  async process() {
    if (this.busy) return;
    this.busy = true;
    try {
      const job = await this.db.transaction(async manager => {
        const next = await manager.getRepository(BackgroundJobEntity).createQueryBuilder('job')
          .where('job.type = :type AND ((job.status = :pending AND job.availableAt <= :now) OR (job.status = :processing AND job.startedAt < :stale))', {
            type: 'delivery-otp-email', pending: JobStatus.PENDING, processing: JobStatus.PROCESSING, now: new Date(), stale: new Date(Date.now() - 300000),
          }).orderBy('job.id', 'ASC').setLock('pessimistic_write').setOnLocked('skip_locked').getOne();
        if (!next) return null;
        if (next.attempts >= next.maxAttempts) { next.status = JobStatus.FAILED; next.failedAt = new Date(); await manager.save(next); this.logger.error(`Notification job ${next.id} exhausted retries`); return null; }
        next.status = JobStatus.PROCESSING; next.startedAt = new Date(); next.attempts++;
        return manager.save(next);
      });
      if (!job) return;
      try {
        const delivery = await this.db.getRepository(DeliveryEntity).findOneBy({ id: Number(job.payload.deliveryId) });
        if (delivery && delivery.status === DeliveryStatus.ARRIVED_AT_CUSTOMER) await this.delivery.sendDeliveryOtpNotifications(delivery);
        await this.db.getRepository(BackgroundJobEntity).update({ id: job.id, attempts: job.attempts, status: JobStatus.PROCESSING }, { status: JobStatus.COMPLETED, completedAt: new Date() });
      } catch {
        const failed = job.attempts >= job.maxAttempts;
        await this.db.getRepository(BackgroundJobEntity).update({ id: job.id, attempts: job.attempts, status: JobStatus.PROCESSING }, {
          status: failed ? JobStatus.FAILED : JobStatus.PENDING, failedAt: failed ? new Date() : null,
          availableAt: new Date(Date.now() + 10000 * 2 ** job.attempts), errorMessage: 'Delivery email failed',
        });
        if (failed) this.logger.error(`Notification job ${job.id} exhausted retries`);
      }
    } catch { this.logger.error('Delivery notification worker could not complete its cycle'); }
    finally { this.busy = false; }
  }
}
