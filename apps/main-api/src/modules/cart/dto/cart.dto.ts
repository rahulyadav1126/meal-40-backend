import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
export class AddCartItemDto {
  @Type(() => Number) @IsInt() @Min(1) menuItemId: number;
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
}
export class UpdateCartItemDto {
  @Type(() => Number) @IsInt() @Min(1) quantity: number;
}
