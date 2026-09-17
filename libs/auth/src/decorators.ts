import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import {
  PUBLIC_ROUTE_KEY,
  ROLES_KEY,
  type AuthenticatedUser,
  UserRole,
} from '@app/contracts';
import type { Request } from 'express';

export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
