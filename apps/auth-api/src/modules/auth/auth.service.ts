import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  ErrorCode,
  TOKEN_TYPE,
  type JwtPayload,
  UserRole,
  UserStatus,
} from '@app/contracts';
import { AuthSessionEntity, UserEntity } from '@app/database';
import type { AuthResponseDto, LoginDto, RegisterDto } from './dto/auth.dto.js';

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}
interface RefreshPayload extends JwtPayload {
  type: typeof TOKEN_TYPE.REFRESH;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(
    dto: RegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    if (![UserRole.CUSTOMER, UserRole.MERCHANT].includes(dto.role))
      throw new UnauthorizedException(ErrorCode.FORBIDDEN);
    if (await this.users.exists({ where: { email: dto.email.toLowerCase() } }))
      throw new ConflictException(ErrorCode.EMAIL_ALREADY_EXISTS);
    if (await this.users.exists({ where: { phone: dto.phone } }))
      throw new ConflictException(ErrorCode.PHONE_ALREADY_EXISTS);
    const user = await this.users.save(
      this.users.create({
        uuid: randomUUID(),
        name: dto.name.trim(),
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash: await hash(dto.password),
        role: dto.role,
        status: UserStatus.ACTIVE,
      }),
    );
    return this.createSession(user, undefined, metadata);
  }

  async login(
    dto: LoginDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email: dto.email })
      .getOne();
    if (
      !user ||
      !(await verify(user.passwordHash, dto.password)) ||
      user.status !== UserStatus.ACTIVE
    )
      throw new UnauthorizedException(ErrorCode.INVALID_CREDENTIALS);
    user.lastLoginAt = new Date();
    await this.users.save(user);
    return this.createSession(user, dto.deviceName, metadata);
  }

  async refresh(refreshToken: string): Promise<AuthResponseDto> {
    let payload: RefreshPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException(ErrorCode.INVALID_REFRESH_TOKEN);
    }
    if (payload.type !== TOKEN_TYPE.REFRESH)
      throw new UnauthorizedException(ErrorCode.INVALID_REFRESH_TOKEN);
    const session = await this.sessions
      .createQueryBuilder('session')
      .addSelect('session.refreshTokenHash')
      .where('session.id = :id', { id: payload.sessionId })
      .andWhere('session.userId = :userId', { userId: payload.sub })
      .getOne();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !(await verify(session.refreshTokenHash, refreshToken))
    )
      throw new UnauthorizedException(ErrorCode.INVALID_REFRESH_TOKEN);
    const user = await this.users.findOneBy({
      id: payload.sub,
      status: UserStatus.ACTIVE,
    });
    if (!user) throw new UnauthorizedException(ErrorCode.INVALID_REFRESH_TOKEN);
    const tokens = await this.signTokens(user, session.id);
    session.refreshTokenHash = await hash(tokens.refreshToken);
    session.expiresAt = this.refreshExpiry();
    await this.sessions.save(session);
    return { ...tokens, user: this.publicUser(user) };
  }

  private async createSession(
    user: UserEntity,
    deviceName: string | undefined,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    let session = await this.sessions.save(
      this.sessions.create({
        userId: user.id,
        refreshTokenHash: await hash(randomUUID()),
        deviceName: deviceName ?? null,
        ipAddress: metadata.ipAddress ?? null,
        userAgent: metadata.userAgent?.slice(0, 500) ?? null,
        expiresAt: this.refreshExpiry(),
        revokedAt: null,
      }),
    );
    const tokens = await this.signTokens(user, session.id);
    session.refreshTokenHash = await hash(tokens.refreshToken);
    await this.sessions.save(session);
    return { ...tokens, user: this.publicUser(user) };
  }

  private async signTokens(user: UserEntity, sessionId: number) {
    const payload: JwtPayload = { sub: user.id, role: user.role, sessionId };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('jwt.accessSecret'),
      expiresIn: this.config.getOrThrow<string>('jwt.accessExpiresIn') as never,
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: TOKEN_TYPE.REFRESH },
      {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: this.config.getOrThrow<string>(
          'jwt.refreshExpiresIn',
        ) as never,
      },
    );
    return { accessToken, refreshToken };
  }

  private refreshExpiry(): Date {
    const duration = this.config.getOrThrow<string>('jwt.refreshExpiresIn');
    const match = /^(\d+)([dhm])$/.exec(duration);
    if (!match) throw new Error('JWT_REFRESH_EXPIRES_IN must use d, h, or m');
    const multipliers = { d: 86_400_000, h: 3_600_000, m: 60_000 } as const;
    return new Date(
      Date.now() +
        Number(match[1]) * multipliers[match[2] as keyof typeof multipliers],
    );
  }
  private publicUser(user: UserEntity) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
  }
}
