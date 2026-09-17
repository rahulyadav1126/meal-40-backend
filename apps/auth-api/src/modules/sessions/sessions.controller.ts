import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import { SessionsService } from './sessions.service.js';

@ApiBearerAuth()
@ApiTags('Sessions')
@Controller('auth')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}
  @Get('sessions') list(@CurrentUser() user: AuthenticatedUser) {
    return this.sessions.list(user.sub);
  }
  @Post('logout') @HttpCode(HttpStatus.NO_CONTENT) logout(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.logout(user.sessionId, user.sub);
  }
  @Post('logout-all') @HttpCode(HttpStatus.NO_CONTENT) logoutAll(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.logoutAll(user.sub);
  }
  @Delete('sessions/:id') @HttpCode(HttpStatus.NO_CONTENT) revoke(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sessions.revoke(id, user.sub);
  }
}
