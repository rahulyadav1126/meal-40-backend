import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { hash, verify } from 'argon2';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import {
  ErrorCode,
  DeliveryPartnerApprovalStatus,
  VerificationStatus,
  TOKEN_TYPE,
  type JwtPayload,
  UserRole,
  UserStatus,
} from '@app/contracts';
import {
  AuthSessionEntity,
  DeliveryPartnerDocumentEntity,
  DeliveryPartnerEntity,
  EmailTemplateEntity,
  UserEntity,
} from '@app/database';
import { NodemailerEmailProvider } from '@app/integrations';
import type {
  AuthResponseDto,
  DeliveryPartnerRegisterDto,
  LoginDto,
  RegisterDto,
} from './dto/auth.dto.js';

/** Render {{variable}} placeholders in an email template string */
function renderTemplate(source: string, vars: Record<string, string>): string {
  return source.replace(
    /{{\s*([A-Za-z][A-Za-z0-9_.]*)\s*}}/g,
    (_match, key: string) => vars[key] ?? '',
  );
}

interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}
interface RefreshPayload extends JwtPayload {
  type: typeof TOKEN_TYPE.REFRESH;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessions: Repository<AuthSessionEntity>,
    @InjectRepository(EmailTemplateEntity)
    private readonly emailTemplates: Repository<EmailTemplateEntity>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mailer: NodemailerEmailProvider,
  ) {}

  async registerDeliveryPartner(
    dto: DeliveryPartnerRegisterDto,
    metadata: RequestMetadata,
  ): Promise<AuthResponseDto> {
    if (await this.users.exists({ where: { email: dto.email.toLowerCase() } }))
      throw new ConflictException(ErrorCode.EMAIL_ALREADY_EXISTS);
    if (await this.users.exists({ where: { phone: dto.phone } }))
      throw new ConflictException(ErrorCode.PHONE_ALREADY_EXISTS);
    const passwordHash = await hash(dto.password);
    const user = await this.dataSource.transaction(async (manager) => {
      const createdUser = await manager.save(
        UserEntity,
        manager.create(UserEntity, {
          uuid: randomUUID(),
          name: dto.name.trim(),
          email: dto.email.toLowerCase(),
          phone: dto.phone,
          passwordHash,
          role: UserRole.DELIVERY_PARTNER,
          status: UserStatus.ACTIVE,
        }),
      );
      const partner = await manager.save(
        DeliveryPartnerEntity,
        manager.create(DeliveryPartnerEntity, {
          userId: createdUser.id,
          profilePhotoUrl: dto.profilePhotoUrl ?? null,
          address: dto.address.trim(),
          vehicleType: dto.vehicleType,
          vehicleNumber: dto.vehicleNumber.trim().toUpperCase(),
          approvalStatus: DeliveryPartnerApprovalStatus.PENDING,
          isOnline: false,
        }),
      );
      await manager.save(
        DeliveryPartnerDocumentEntity,
        manager.create(DeliveryPartnerDocumentEntity, {
          deliveryPartnerId: partner.id,
          type: dto.documentType,
          documentNumber: dto.documentNumber.trim(),
          documentUrl: dto.documentUrl ?? null,
          status: VerificationStatus.PENDING,
        }),
      );
      return createdUser;
    });

    // Send welcome email — fire-and-forget
    this.sendWelcomeEmail(user).catch((err: unknown) =>
      this.logger.warn(
        `Welcome email failed for ${user.email}: ${String(err)}`,
      ),
    );

    return this.createSession(user, dto.deviceName, metadata);
  }

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

    // Send welcome email — fire-and-forget so SMTP errors never break registration
    this.sendWelcomeEmail(user).catch((err: unknown) =>
      this.logger.warn(
        `Welcome email failed for ${user.email}: ${String(err)}`,
      ),
    );

    return this.createSession(user, dto.deviceName, metadata);
  }

  private async sendWelcomeEmail(user: UserEntity): Promise<void> {
    if (!user.email) return;

    const frontendUrl =
      this.config.get<string>('app.frontendCustomerUrl') ??
      'http://localhost:3000';
    const dashboardUrl =
      user.role === UserRole.MERCHANT || user.role === UserRole.DELIVERY_PARTNER
        ? (this.config.get<string>('app.frontendDashboardUrl') ??
          'http://localhost:3001')
        : frontendUrl;
    const loginLink = `${dashboardUrl}/login`;
    const appName = 'Plate40';
    const currentYear = String(new Date().getFullYear());

    // ── Load template from DB (seeded WELCOME template) ───────────────────────
    const template = await this.emailTemplates.findOne({
      where: { templateKey: 'WELCOME', locale: 'en', isActive: true },
    });

    const vars: Record<string, string> = {
      name: user.name,
      loginLink,
      appName,
      currentYear,
    };

    let subject: string;
    let html: string;
    let text: string;

    if (template) {
      // Use the DB template — renders {{name}}, {{loginLink}}, {{appName}}, {{currentYear}}
      subject = renderTemplate(template.subjectTemplate, vars);
      html = renderTemplate(template.htmlBody, vars);
      text = renderTemplate(template.textBody, vars);
      this.logger.log(`Sending WELCOME email via DB template to ${user.email}`);
    } else {
      // Fallback: plain inline email if template not found in DB
      this.logger.warn(
        'WELCOME email template not found in DB — using inline fallback',
      );
      subject = `Welcome to ${appName}, ${user.name}!`;
      text = `Hi ${user.name},\n\nWelcome to ${appName}! Sign in here: ${loginLink}\n\n— The ${appName} Team`;
      html = `<h1>Welcome, ${user.name}!</h1><p>Your account is ready. <a href="${loginLink}">Sign in</a></p>`;
    }

    await this.mailer.send({ to: user.email, subject, html, text });
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
