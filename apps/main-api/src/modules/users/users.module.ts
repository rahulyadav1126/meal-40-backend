<<<<<<< Updated upstream
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Module,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Not, Repository } from 'typeorm';
import { CurrentUser } from '@app/auth';
import { type AuthenticatedUser, ErrorCode } from '@app/contracts';
import { UserEntity } from '@app/database';

class UpdateProfileDto {
  @IsString() @Length(2, 120) @IsOptional() name?: string;
  @IsEmail() @MaxLength(191) @IsOptional() email?: string;
  @IsPhoneNumber('IN') @IsOptional() phone?: string;
}

@Injectable()
class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  me(userId: number) {
    return this.users.findOneByOrFail({ id: userId });
  }

  async update(userId: number, dto: UpdateProfileDto) {
    const user = await this.me(userId);
    const email = dto.email?.trim().toLowerCase();
    const phone = dto.phone?.trim();
    if (
      email &&
      (await this.users.exists({ where: { email, id: Not(userId) } }))
    )
      throw new ConflictException(ErrorCode.EMAIL_ALREADY_EXISTS);
    if (
      phone &&
      (await this.users.exists({ where: { phone, id: Not(userId) } }))
    )
      throw new ConflictException(ErrorCode.PHONE_ALREADY_EXISTS);
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    return this.users.save(user);
  }
}

@ApiBearerAuth()
@ApiTags('User Profile')
@Controller('users/me')
class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() me(@CurrentUser() user: AuthenticatedUser) {
    return this.users.me(user.sub);
  }
  @Patch() update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.update(user.sub, dto);
  }
}
=======
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '@app/database';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
>>>>>>> Stashed changes

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
