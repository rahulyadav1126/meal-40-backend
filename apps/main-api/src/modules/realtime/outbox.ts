import type { EntityManager } from 'typeorm';
import { BackgroundJobEntity } from '@app/database';
import { JobStatus } from '@app/contracts';

export async function enqueueEvent(manager: EntityManager, target: 'user' | 'restaurant' | 'admin', id: number | null, event: string, data: unknown) {
  await manager.save(BackgroundJobEntity, manager.create(BackgroundJobEntity, {
    type: 'realtime', payload: { target, id, event, data }, status: JobStatus.PENDING,
    attempts: 0, maxAttempts: 10, availableAt: new Date(),
  }));
}
