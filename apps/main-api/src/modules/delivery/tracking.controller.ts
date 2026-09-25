import { Body, Controller, Get, Header, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '@app/auth';
import { type AuthenticatedUser, UserRole } from '@app/contracts';
import { DeliveryLocationDto, TrackingService } from './tracking.service.js';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}
  @Roles(UserRole.DELIVERY_PARTNER)
  @Post('deliveries/:id/location')
  publish(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number, @Body() dto: DeliveryLocationDto) {
    return this.tracking.publish(user.sub, id, dto);
  }
  @Roles(UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.DELIVERY_PARTNER, UserRole.ADMIN)
  @Get('orders/:id')
  @Header('Cache-Control', 'private, no-store')
  snapshot(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.tracking.snapshot(user, id);
  }
}
