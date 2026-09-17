import { OtpPurpose } from '@app/contracts';
import { IsEnum, IsString, Length, MaxLength } from 'class-validator';
export class CreateOtpDto {
  @IsString() @MaxLength(191) identifier: string;
  @IsEnum(OtpPurpose) purpose: OtpPurpose;
}
export class VerifyOtpDto extends CreateOtpDto {
  @IsString() @Length(6, 6) code: string;
}
