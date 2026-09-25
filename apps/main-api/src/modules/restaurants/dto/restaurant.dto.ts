import {
  FoodType,
  Cuisine,
  RestaurantOpeningStatus,
  RestaurantSortField,
} from '@app/contracts';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsArray,
  ArrayMaxSize,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumberString,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '@app/common';

export class CreateRestaurantDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsEnum(Cuisine, { each: true }) cuisines?: Cuisine[] | null;
  @ApiProperty() @IsString() @Length(2, 160) name: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsPhoneNumber('IN') phone: string;
  @IsEmail() @IsOptional() email?: string;
  @IsUrl() @IsOptional() logoUrl?: string;
  @IsUrl() @IsOptional() coverImageUrl?: string;
  @IsString() @MaxLength(255) addressLine1: string;
  @IsString() @MaxLength(255) @IsOptional() addressLine2?: string;
  @IsString() @MaxLength(100) city: string;
  @IsString() @MaxLength(100) state: string;
  @IsString() @MaxLength(20) postalCode: string;
  @IsLatitude() latitude: string;
  @IsLongitude() longitude: string;
  @IsNumberString() deliveryRadiusKm: string;
  @IsNumberString() minimumOrderAmount: string;
}
export class UpdateRestaurantDto extends PartialType(CreateRestaurantDto) {
  @IsEnum(RestaurantOpeningStatus)
  @IsOptional()
  openingStatus?: RestaurantOpeningStatus;
}
export class RestaurantQueryDto extends PaginationDto {
  @IsEnum(FoodType) @IsOptional() foodType?: FoodType;
  @Transform(({ value }) => Number(value))
  @Min(0)
  @IsOptional()
  minimumRating?: number;
  @IsEnum(RestaurantSortField)
  @IsOptional()
  declare sortBy?: RestaurantSortField;
}
