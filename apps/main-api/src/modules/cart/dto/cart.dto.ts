import { IsInt, Min } from 'class-validator';
export class AddCartItemDto {
  @IsInt() @Min(1) menuItemId: number;
  @IsInt() @Min(1) quantity: number;
}
export class UpdateCartItemDto {
  @IsInt() @Min(1) quantity: number;
}
