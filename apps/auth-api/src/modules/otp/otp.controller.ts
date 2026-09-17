import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@app/auth';
import { CreateOtpDto, VerifyOtpDto } from './dto/otp.dto.js';
import { OtpService } from './otp.service.js';
@Public()
@ApiTags('OTP')
@Controller('auth/otp')
export class OtpController {
  constructor(private readonly otp: OtpService) {}
  @Post('request') async request(@Body() dto: CreateOtpDto) {
    await this.otp.create(dto.identifier, dto.purpose);
    return { message: 'If the identifier is eligible, an OTP will be sent' };
  }
  @Post('verify') @HttpCode(HttpStatus.NO_CONTENT) verify(
    @Body() dto: VerifyOtpDto,
  ) {
    return this.otp.verify(dto.identifier, dto.purpose, dto.code);
  }
}
