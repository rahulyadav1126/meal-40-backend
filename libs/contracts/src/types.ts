import type { UserRole } from './enums.js';

export interface JwtPayload {
  sub: number;
  role: UserRole;
  sessionId: number;
}
export interface AuthenticatedUser extends JwtPayload {}
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  meta?: PaginationMeta;
}
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  path: string;
  timestamp: string;
}
export interface PaginatedResult<T> {
  items: T[];
  meta: PaginationMeta;
}
