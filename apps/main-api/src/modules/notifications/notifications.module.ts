import {
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import { EmailTemplateEntity, NotificationEntity } from '@app/database';
import { NodemailerEmailProvider } from '@app/integrations';
import { EmailNotificationService } from './email-notification.service.js';
import { EmailTemplateRenderer } from './email-template.renderer.js';
@Injectable()
class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notifications: Repository<NotificationEntity>,
  ) {}
  list(userId: number) {
    return this.notifications.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
  async read(userId: number, id: number) {
    await this.notifications.update(
      { id, userId },
      { isRead: true, readAt: new Date() },
    );
  }
  async readAll(userId: number) {
    await this.notifications.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }
}
@ApiBearerAuth()
@ApiTags('Notifications')
@Controller('notifications')
class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.list(user.sub);
  }
  @Patch(':id/read') read(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.notifications.read(user.sub, id);
  }
  @Patch('read-all') readAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.readAll(user.sub);
  }
}
@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationEntity, EmailTemplateEntity]),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    EmailTemplateRenderer,
    EmailNotificationService,
    NodemailerEmailProvider,
  ],
  exports: [NotificationsService, EmailNotificationService],
})
export class NotificationsModule {}
