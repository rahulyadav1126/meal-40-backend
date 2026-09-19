import { DeliveryDocumentType, UserRole, VehicleType } from '@app/contracts';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty() @IsString() @Length(2, 120) name: string;
  @ApiProperty() @IsEmail() @MaxLength(191) email: string;
  @ApiProperty() @IsPhoneNumber('IN') phone: string;
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string;
  @ApiPropertyOptional({ enum: [UserRole.CUSTOMER, UserRole.MERCHANT] })
  @IsEnum(UserRole)
  @IsOptional()
  role: UserRole = UserRole.CUSTOMER;
}
export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
  @ApiPropertyOptional() @IsString() @IsOptional() deviceName?: string;
}
export class DeliveryPartnerRegisterDto extends RegisterDto {
  @ApiPropertyOptional() @IsString() @IsOptional() profilePhotoUrl?: string;
  @ApiProperty() @IsString() @Length(5, 500) address: string;
  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;
  @ApiProperty() @IsString() @Length(3, 30) vehicleNumber: string;
  @ApiProperty({ enum: DeliveryDocumentType })
  @IsEnum(DeliveryDocumentType)
  documentType: DeliveryDocumentType;
  @ApiProperty() @IsString() @Length(3, 100) documentNumber: string;
  @ApiPropertyOptional() @IsString() @IsOptional() documentUrl?: string;
}
export class RefreshTokenDto {
  @ApiProperty() @IsString() refreshToken: string;
}

export class AuthUserResponseDto {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
}
export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: AuthUserResponseDto;
}
