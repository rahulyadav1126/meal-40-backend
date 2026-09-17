import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessResponse, PaginatedResult } from '@app/contracts';

interface MessageResult<T> {
  message?: string;
  data: T;
}
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<unknown>
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<unknown>> {
    return next.handle().pipe(map((value) => this.wrap(value)));
  }
  private wrap(value: T): ApiSuccessResponse<unknown> {
    if (this.isPaginated(value))
      return {
        success: true,
        message: 'Request completed successfully',
        data: value.items,
        meta: value.meta,
      };
    if (this.hasData(value))
      return {
        success: true,
        message: value.message ?? 'Request completed successfully',
        data: value.data,
      };
    return {
      success: true,
      message: 'Request completed successfully',
      data: value,
    };
  }
  private isPaginated(value: unknown): value is PaginatedResult<unknown> {
    return (
      typeof value === 'object' &&
      value !== null &&
      'items' in value &&
      'meta' in value
    );
  }
  private hasData(value: unknown): value is MessageResult<unknown> {
    return typeof value === 'object' && value !== null && 'data' in value;
  }
}
