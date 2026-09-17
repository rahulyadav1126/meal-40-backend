import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ErrorCode, type ApiErrorResponse } from '@app/contracts';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    const details =
      typeof body === 'object' && body !== null
        ? (body as Record<string, unknown>)
        : {};
    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode,
      error:
        typeof details.error === 'string'
          ? details.error
          : ErrorCode.INTERNAL_SERVER_ERROR,
      message: this.message(details.message, exception),
      path: request.originalUrl,
      timestamp: new Date().toISOString(),
    };
    response.status(statusCode).json(errorResponse);
  }

  private message(value: unknown, exception: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'string') return value;
    return exception instanceof Error && !(exception instanceof HttpException)
      ? 'An unexpected error occurred'
      : 'Request failed';
  }
}
