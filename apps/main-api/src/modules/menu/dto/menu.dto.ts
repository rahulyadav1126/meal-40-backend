import { FoodType } from '@app/contracts';
import { PartialType } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateMenuItemDto {
  @IsInt() @Min(1) restaurantId: number;
  @IsInt() @Min(1) categoryId: number;
  @IsString() @Length(2, 160) name: string;
  @IsString() @MaxLength(2000) @IsOptional() description?: string;
  @IsUrl() @IsOptional() imageUrl?: string;
  @IsEnum(FoodType) foodType: FoodType;
  @IsNumberString() price: string;
  @IsNumberString() @IsOptional() discountedPrice?: string;
  @IsInt() @Min(1) preparationTimeMinutes: number;
  @IsInt() @Min(0) @IsOptional() displayOrder?: number;
  @IsBoolean() @IsOptional() isAvailable?: boolean;
}
export class UpdateMenuItemDto extends PartialType(CreateMenuItemDto) {
  @IsBoolean() @IsOptional() isFeatured?: boolean;
}
