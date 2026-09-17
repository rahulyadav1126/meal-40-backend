import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from '@app/auth';
import {
  RAZORPAY_EVENT_ID_HEADER,
  RAZORPAY_SIGNATURE_HEADER,
  type AuthenticatedUser,
  UserRole,
} from '@app/contracts';
import { CreatePaymentDto, VerifyPaymentDto } from './dto/payments.dto.js';
import { PaymentsService } from './payments.service.js';
interface RawRequest extends Request {
  rawBody?: Buffer;
}
@ApiTags('Payments')
@Controller('payments/razorpay')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @ApiBearerAuth() @Roles(UserRole.CUSTOMER) @Post('create') create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(user.sub, dto.orderId);
  }
  @ApiBearerAuth() @Roles(UserRole.CUSTOMER) @Post('verify') verify(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.payments.verify(
      user.sub,
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
  }
  @Public() @Post('webhook') @HttpCode(HttpStatus.NO_CONTENT) webhook(
    @Headers(RAZORPAY_SIGNATURE_HEADER) signature: string,
    @Headers(RAZORPAY_EVENT_ID_HEADER) eventId: string | undefined,
    @Req() request: RawRequest,
  ) {
    return this.payments.webhook(
      eventId,
      request.rawBody ?? Buffer.from(JSON.stringify(request.body)),
      signature,
      request.body as never,
    );
  }
}
