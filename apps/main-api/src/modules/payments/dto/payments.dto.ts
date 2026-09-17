import { IsInt, IsString, Min } from 'class-validator';
export class CreatePaymentDto {
  @IsInt() @Min(1) orderId: number;
}
export class VerifyPaymentDto {
  @IsString() razorpayOrderId: string;
  @IsString() razorpayPaymentId: string;
  @IsString() razorpaySignature: string;
}
