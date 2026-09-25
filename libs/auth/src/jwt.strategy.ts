import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthSessionEntity, UserEntity } from '@app/database';
import { UserStatus } from '@app/contracts';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser, JwtPayload } from '@app/contracts';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly db: DataSource) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.accessSecret'),
      algorithms: ['HS256'],
    });
  }
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload.sub || !payload.sessionId || (payload as JwtPayload & { type?: string }).type === 'refresh') throw new UnauthorizedException('Invalid access token');
    const session = await this.db.getRepository(AuthSessionEntity).findOneBy({ id: payload.sessionId, userId: payload.sub });
    const user = await this.db.getRepository(UserEntity).findOneBy({ id: payload.sub, status: UserStatus.ACTIVE });
    if (!session || session.revokedAt || session.expiresAt <= new Date() || !user || !user.isActive) throw new UnauthorizedException('Session expired or revoked');
    return { ...payload, role: user.role };
  }
}
