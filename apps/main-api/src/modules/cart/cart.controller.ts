import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@app/auth';
import { type AuthenticatedUser, UserRole } from '@app/contracts';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto.js';
import { CartService } from './cart.service.js';
@ApiBearerAuth()
@ApiTags('Cart')
@Roles(UserRole.CUSTOMER)
@Controller('cart')
export class CartController {
  constructor(private readonly cart: CartService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.cart.list(user.sub);
  }
  @Get(':id/items') items(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cart.itemsForCart(user.sub, id);
  }
  @Post('items') add(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cart.add(user.sub, dto.menuItemId, dto.quantity);
  }
  @Patch('items/:id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cart.update(user.sub, id, dto.quantity);
  }
  @Delete('items/:id') @HttpCode(HttpStatus.NO_CONTENT) remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cart.removeItem(user.sub, id);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.cart.clear(user.sub, id);
  }
}
