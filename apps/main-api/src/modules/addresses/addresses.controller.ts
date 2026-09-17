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
import { ApiBearerAuth, ApiTags, PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';
import { CurrentUser, Roles } from '@app/auth';
import { AddressLabel, type AuthenticatedUser, UserRole } from '@app/contracts';
import { AddressesService } from './addresses.service.js';
export class CreateAddressDto {
  @IsEnum(AddressLabel) label: AddressLabel;
  @IsString() @MaxLength(120) recipientName: string;
  @IsPhoneNumber('IN') phone: string;
  @IsString() @MaxLength(255) addressLine1: string;
  @IsString() @MaxLength(255) @IsOptional() addressLine2?: string;
  @IsString() @MaxLength(120) @IsOptional() landmark?: string;
  @IsString() @MaxLength(100) city: string;
  @IsString() @MaxLength(100) state: string;
  @IsString() @MaxLength(20) postalCode: string;
  @IsLatitude() latitude: string;
  @IsLongitude() longitude: string;
  @IsBoolean() @IsOptional() isDefault?: boolean;
}
export class UpdateAddressDto extends PartialType(CreateAddressDto) {}
@ApiBearerAuth()
@ApiTags('Addresses')
@Roles(UserRole.CUSTOMER)
@Controller('addresses')
export class AddressesController {
  constructor(private readonly addresses: AddressesService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) {
    return this.addresses.list(user.sub);
  }
  @Post() create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addresses.create(user.sub, dto);
  }
  @Patch(':id') update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addresses.update(user.sub, id, dto);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT) remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.addresses.remove(user.sub, id);
  }
}
