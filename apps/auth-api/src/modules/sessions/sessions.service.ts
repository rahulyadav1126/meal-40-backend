import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { AuthSessionEntity } from '@app/database';

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
  ) {}
  list(userId: number) {
    return this.sessions.find({
      where: { userId, revokedAt: IsNull(), expiresAt: MoreThan(new Date()) },
      select: {
        id: true,
        deviceName: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
  async logout(sessionId: number, userId: number): Promise<void> {
    await this.revoke(sessionId, userId);
  }
  async logoutAll(userId: number): Promise<void> {
    await this.sessions
      .createQueryBuilder()
      .update()
      .set({ revokedAt: new Date() })
      .where('user_id = :userId', { userId })
      .andWhere('revoked_at IS NULL')
      .execute();
  }
  async revoke(sessionId: number, userId: number): Promise<void> {
    const session = await this.sessions.findOneBy({ id: sessionId });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new ForbiddenException('Cannot revoke another user session');
    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessions.save(session);
    }
  }
}
