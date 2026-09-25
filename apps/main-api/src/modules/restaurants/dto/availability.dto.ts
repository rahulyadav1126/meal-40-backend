import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, Matches, ValidateNested } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import type { AvailabilitySettings, ServiceInterval } from '@app/common';

export class IntervalDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) opens: string;
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) closes: string;
}
export class WeeklyIntervalDto extends IntervalDto {
  @IsInt() @Min(0) @Max(6) day: number;
}
export class ExceptionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/) date: string;
  @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => IntervalDto)
  intervals: IntervalDto[];
}
export class AvailabilityDto implements AvailabilitySettings {
  @IsInt() @Min(0) expectedVersion: number;
  @IsString() @MaxLength(100) timezone: string;
  @IsIn(['SCHEDULED', 'FORCED_OPEN', 'FORCED_CLOSED']) availabilityMode: AvailabilitySettings['availabilityMode'];
  @IsOptional() @IsISO8601() overrideExpiresAt?: string | null;
  @IsOptional() @IsString() @MaxLength(200) overrideReason?: string | null;
  @IsArray() @ArrayMaxSize(56) @ValidateNested({ each: true }) @Type(() => WeeklyIntervalDto)
  weeklyHours: WeeklyIntervalDto[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => ExceptionDto)
  exceptions: ExceptionDto[];
}
export function validateIntervals(intervals: Array<{ opens: string; closes: string; day?: number }>, weekly = false) {
  const spans: Array<[number, number]> = [];
  for (const i of intervals) {
    const toMinute = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
    const start = toMinute(i.opens), end = toMinute(i.closes);
    if (start === end) throw new BadRequestException('Opening and closing times must differ. Use two intervals for 24-hour service.');
    const base = weekly ? (i.day ?? 0) * 1440 : 0;
    spans.push([base + start, base + end + (end < start ? 1440 : 0)]);
  }
  const expanded = weekly ? [...spans, ...spans.map(([a, b]) => [a + 10080, b + 10080] as [number, number])] : spans;
  expanded.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < expanded.length; i++) if (expanded[i][0] < expanded[i - 1][1]) throw new BadRequestException('Operating intervals overlap');
}
export function validateAvailability(settings: AvailabilityDto) {
  try { new Intl.DateTimeFormat('en', { timeZone: settings.timezone }).format(); }
  catch { throw new BadRequestException('Unknown timezone'); }
  if (settings.overrideExpiresAt && Date.parse(settings.overrideExpiresAt) <= Date.now()) throw new BadRequestException('Override expiry must be in the future');
  validateIntervals(settings.weeklyHours as ServiceInterval[], true);
  const dates = new Set<string>();
  for (const e of settings.exceptions) {
    const parsed = new Date(`${e.date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== e.date || dates.has(e.date)) throw new BadRequestException('Invalid or duplicate exception date');
    dates.add(e.date); validateIntervals(e.intervals);
  }
}
