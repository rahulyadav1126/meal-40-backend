import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@app/auth';
import { type AuthenticatedUser, UserRole } from '@app/contracts';
import {
  CreateRestaurantDto,
  RestaurantQueryDto,
  UpdateRestaurantDto,
} from './dto/restaurant.dto.js';
import { RestaurantsService } from './restaurants.service.js';
import { AvailabilityDto } from './dto/availability.dto.js';

@Public()
@ApiTags('Restaurants')
@Controller('restaurants')
export class RestaurantsController {
  constructor(private readonly service: RestaurantsService) {}
  @Get() list(@Query() query: RestaurantQueryDto) {
    return this.service.publicList(query);
  }
  @Get(':id') get(@Param('id', ParseIntPipe) id: number) {
    return this.service.publicGet(id);
  }
}
@ApiBearerAuth()
@ApiTags('Merchant Restaurants')
@Roles(UserRole.MERCHANT)
@Controller('merchant/restaurants')
export class MerchantRestaurantsController {
  constructor(private readonly service: RestaurantsService) {}
  @Patch(':id/availability') availability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AvailabilityDto,
  ) { return this.service.updateAvailability(user.sub, id, dto); }
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.merchantList(user.sub);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRestaurantDto,
  ) {
    return this.service.create(user, dto);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRestaurantDto,
  ) {
    return this.service.update(user.sub, id, dto);
  }
}
