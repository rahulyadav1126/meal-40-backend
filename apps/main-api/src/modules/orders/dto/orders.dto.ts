import { OrderStatus, PaymentMethod } from '@app/contracts';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
export class CreateOrderDto {
  @Type(() => Number) @IsInt() @Min(1) cartId: number;
  @Type(() => Number) @IsInt() @Min(1) addressId: number;
  @Type(() => Number) @IsInt() @Min(1) @IsOptional() couponId?: number;
  @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @IsString() @MaxLength(500) @IsOptional() customerNote?: string;
}
export class ChangeOrderStatusDto {
  @IsEnum(OrderStatus) status: OrderStatus;
  @IsString() @MaxLength(500) @IsOptional() note?: string;
}
export class OrderNoteDto {
  @IsString() @MaxLength(500) @IsOptional() note?: string;
}
export class CancelOrderDto {
  @IsString() @MaxLength(500) reason: string;
}
