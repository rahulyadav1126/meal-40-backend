import { IsBoolean, IsOptional, IsString, Length } from 'class-validator';

export class DeliveryAvailabilityDto {
  @IsBoolean() isOnline: boolean;
}

export class DeliveryOtpDto {
  @IsOptional() @IsBoolean() cashCollected?: boolean;
  @IsString() @Length(6, 6) otp: string;
}
