import { Body, Controller, Patch, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '@app/auth';
import type { AuthenticatedUser } from '@app/contracts';
import { UpdateProfileDto } from './dto/users.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get('me') me(@CurrentUser() user: AuthenticatedUser) { return this.users.me(user.sub); }

  @Patch('me')
  updateProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.sub, dto);
  }
}
