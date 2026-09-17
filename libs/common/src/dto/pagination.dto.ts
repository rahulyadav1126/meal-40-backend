import { DEFAULT_PAGE, DEFAULT_PAGE_LIMIT, SortOrder } from '@app/contracts';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @IsOptional() page =
    DEFAULT_PAGE;
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit = DEFAULT_PAGE_LIMIT;
  @IsString() @IsOptional() search?: string;
  @IsString() @IsOptional() sortBy?: string;
  @IsEnum(SortOrder) @IsOptional() sortOrder = SortOrder.DESC;
}
