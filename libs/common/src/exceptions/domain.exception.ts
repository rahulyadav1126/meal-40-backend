import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '@app/contracts';

export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ error: code, message }, status);
  }
}
