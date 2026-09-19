import { IsBoolean, IsString, Length } from 'class-validator';

export class DeliveryAvailabilityDto {
  @IsBoolean() isOnline: boolean;
}

export class DeliveryOtpDto {
  @IsString() @Length(6, 6) otp: string;
}
