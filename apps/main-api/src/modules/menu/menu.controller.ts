import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Public, Roles } from '@app/auth';
import { type AuthenticatedUser, UserRole } from '@app/contracts';
import { CreateMenuItemDto, UpdateMenuItemDto } from './dto/menu.dto.js';
import { MenuService } from './menu.service.js';
@Public()
@ApiTags('Menu')
@Controller('restaurants/:restaurantId/menu')
export class PublicMenuController {
  constructor(private readonly menu: MenuService) {}
  @Get() list(@Param('restaurantId', ParseIntPipe) restaurantId: number) {
    return this.menu.publicMenu(restaurantId);
  }
}
@ApiBearerAuth()
@Roles(UserRole.MERCHANT)
@ApiTags('Merchant Menu')
@Controller('merchant/menu')
export class MerchantMenuController {
  constructor(private readonly menu: MenuService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.menu.merchantMenu(user.sub);
  }
  @Post('image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5_000_000 } }))
  uploadImage(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile()
    file?: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
  ) {
    if (!file) throw new BadRequestException('Image file is required');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      throw new BadRequestException(
        'Only JPG, PNG, and WebP images are allowed',
      );
    }
    return this.menu.uploadImage(user.sub, file.buffer);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMenuItemDto,
  ) {
    return this.menu.create(user.sub, dto);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menu.update(user.sub, id, dto);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.menu.remove(user.sub, id);
  }
}
