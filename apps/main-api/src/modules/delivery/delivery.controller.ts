import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@app/auth';
import {
  type AuthenticatedUser,
  DeliveryPartnerApprovalStatus,
  UserRole,
  VerificationStatus,
} from '@app/contracts';
import { DeliveryAvailabilityDto, DeliveryOtpDto } from './dto/delivery.dto.js';
import { DeliveryService } from './delivery.service.js';

@ApiBearerAuth()
@ApiTags('Delivery Partner')
@Roles(UserRole.DELIVERY_PARTNER)
@Controller('delivery')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}
  @Get('profile') profile(@CurrentUser() user: AuthenticatedUser) {
    return this.delivery.profile(user.sub);
  }
  @Patch('availability') availability(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeliveryAvailabilityDto,
  ) {
    return this.delivery.setOnline(user.sub, dto.isOnline);
  }
  @Get('available') available(@CurrentUser() user: AuthenticatedUser) {
    return this.delivery.available(user.sub);
  }
  @Get('active') active(@CurrentUser() user: AuthenticatedUser) {
    return this.delivery.active(user.sub);
  }
  @Get('history') history(@CurrentUser() user: AuthenticatedUser) {
    return this.delivery.history(user.sub);
  }
  @Get('earnings') earnings(@CurrentUser() user: AuthenticatedUser) {
    return this.delivery.earnings(user.sub);
  }
  @Post(':id/accept') accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.accept(user.sub, id);
  }
  @Post(':id/reject') reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.reject(user.sub, id);
  }
  @Post(':id/arrived-merchant') arrivedMerchant(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.arriveMerchant(user.sub, id);
  }
  @Post(':id/pickup') pickup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.pickup(user.sub, id);
  }
  @Post(':id/out-for-delivery') outForDelivery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.outForDelivery(user.sub, id);
  }
  @Post(':id/arrived-customer') arrivedCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.arriveCustomer(user.sub, id);
  }
  @Post(':id/complete') complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DeliveryOtpDto,
  ) {
    return this.delivery.complete(user.sub, id, dto.otp);
  }
}

@ApiBearerAuth()
@ApiTags('Admin Delivery')
@Roles(UserRole.ADMIN)
@Controller('admin/delivery')
export class AdminDeliveryController {
  constructor(private readonly delivery: DeliveryService) {}
  @Get('partners') partners() {
    return this.delivery.listAdmin();
  }
  @Get('deliveries') deliveries() {
    return this.delivery.listAdminDeliveries();
  }
  @Patch('partners/:id/approve') approve(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.adminStatus(
      id,
      DeliveryPartnerApprovalStatus.APPROVED,
    );
  }
  @Patch('partners/:id/reject') reject(@Param('id', ParseIntPipe) id: number) {
    return this.delivery.adminStatus(
      id,
      DeliveryPartnerApprovalStatus.REJECTED,
    );
  }
  @Patch('partners/:id/suspend') suspend(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.adminStatus(
      id,
      DeliveryPartnerApprovalStatus.SUSPENDED,
    );
  }
  @Patch('partners/:id/activate') activate(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.adminStatus(
      id,
      DeliveryPartnerApprovalStatus.APPROVED,
    );
  }
  @Patch('documents/:id/verify') verify(@Param('id', ParseIntPipe) id: number) {
    return this.delivery.verifyDocument(id, VerificationStatus.VERIFIED);
  }
  @Patch('documents/:id/reject') rejectDocument(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.delivery.verifyDocument(id, VerificationStatus.REJECTED);
  }
}
