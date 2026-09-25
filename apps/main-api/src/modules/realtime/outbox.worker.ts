import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { BackgroundJobEntity } from '@app/database';
import { JobStatus } from '@app/contracts';
import { RealtimeGateway } from './realtime.gateway.js';

@Injectable()
export class OutboxWorker {
  private running = false;
  private readonly logger = new Logger(OutboxWorker.name);
  constructor(private readonly db: DataSource, private readonly realtime: RealtimeGateway) {}
  @Interval(1000)
  async publish() {
    if (this.running || !this.realtime.server) return;
    this.running = true;
    try {
      for (let i = 0; i < 50; i++) {
        const found = await this.db.transaction(async manager => {
          const job = await manager.getRepository(BackgroundJobEntity).createQueryBuilder('job')
            .where('job.type = :type AND job.status = :status AND job.availableAt <= :now', { type: 'realtime', status: JobStatus.PENDING, now: new Date() })
            .orderBy('job.id', 'ASC').setLock('pessimistic_write').setOnLocked('skip_locked').getOne();
          if (!job) return false;
          try {
            const { target, id, event, data } = job.payload;
            if (target === 'user') this.realtime.emitToUser(Number(id), String(event), data);
            else if (target === 'restaurant') this.realtime.emitToRestaurant(Number(id), String(event), data);
            else if (target === 'admin') this.realtime.emitToAdmin(String(event), data);
            else throw new Error('Unknown event target');
            job.status = JobStatus.COMPLETED; job.completedAt = new Date();
          } catch {
            job.attempts++;
            job.availableAt = new Date(Date.now() + Math.min(300000, 1000 * 2 ** job.attempts));
            job.errorMessage = 'Realtime publication failed';
            if (job.attempts >= job.maxAttempts) { job.status = JobStatus.FAILED; job.failedAt = new Date(); this.logger.error(`Outbox job ${job.id} exhausted retries`); }
          }
          await manager.save(job); return true;
        });
        if (!found) break;
      }
    } catch { this.logger.error('Outbox cycle failed; pending events remain durable'); }
    finally { this.running = false; }
  }
}
