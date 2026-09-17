import { Body, Controller, Headers, Ip, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@app/auth';
import { AuthService } from './auth.service.js';
import { LoginDto, RefreshTokenDto, RegisterDto } from './dto/auth.dto.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('register') register(
    @Body() dto: RegisterDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.register(dto, { ipAddress, userAgent });
  }
  @Public() @Post('login') login(
    @Body() dto: LoginDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.auth.login(dto, { ipAddress, userAgent });
  }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh(dto.refreshToken);
  }
}
