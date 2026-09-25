import { Cuisine, FoodType } from '@app/contracts';
import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsISO8601,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WeeklyIntervalDto } from '../../restaurants/dto/availability.dto.js';
export class CreateMenuItemDto {
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsEnum(Cuisine, { each: true }) cuisines?: Cuisine[] | null;
  @IsOptional() @IsISO8601() discountStartsAt?: string | null;
  @IsOptional() @IsISO8601() discountEndsAt?: string | null;
  @IsOptional() @IsISO8601() soldOutUntil?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(56) @ValidateNested({ each: true }) @Type(() => WeeklyIntervalDto) serviceHours?: WeeklyIntervalDto[] | null;
  @IsInt() @Min(1) restaurantId: number;
  @IsOptional() @IsInt() @Min(1) categoryId?: number | null;
  @IsString() @Length(2, 160) name: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsUrl() @IsOptional() imageUrl?: string;
  @IsEnum(FoodType) foodType: FoodType;
  @IsNumberString() price: string;
  @IsNumberString() @IsOptional() discountedPrice?: string | null;
  @IsInt() @Min(1) @Max(1440) preparationTimeMinutes: number;
  @IsInt() @Min(0) @IsOptional() displayOrder?: number;
  @IsBoolean() @IsOptional() isAvailable?: boolean;
}
export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {
  @IsBoolean() @IsOptional() isFeatured?: boolean;
}
