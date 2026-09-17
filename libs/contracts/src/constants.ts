import { OrderStatus } from './enums.js';

export const APP_NAME = 'Plate40' as const;
export const API_PREFIX = 'api' as const;
export const API_VERSION = '1' as const;
export const DEFAULT_AUTH_API_PORT = 4001;
export const DEFAULT_MAIN_API_PORT = 4002;
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_LIMIT = 20;
export const DEFAULT_MAX_PAGE_LIMIT = 100;
export const DEFAULT_CURRENCY = 'INR' as const;
export const DEFAULT_COUNTRY = 'IN' as const;
export const ORDER_NUMBER_PREFIX = 'PLT' as const;
export const REQUEST_ID_HEADER = 'x-request-id' as const;
export const RAZORPAY_SIGNATURE_HEADER = 'x-razorpay-signature' as const;
export const RAZORPAY_EVENT_ID_HEADER = 'x-razorpay-event-id' as const;
export const RAZORPAY_EVENT = {
  PAYMENT_CAPTURED: 'payment.captured',
  PAYMENT_FAILED: 'payment.failed',
} as const;
export const PUBLIC_ROUTE_KEY = 'plate40:public' as const;
export const ROLES_KEY = 'plate40:roles' as const;
export const TOKEN_TYPE = { ACCESS: 'access', REFRESH: 'refresh' } as const;
export const SWAGGER_PATH = 'docs' as const;
export const DATABASE_TABLE = {
  USERS: 'users',
  AUTH_SESSIONS: 'auth_sessions',
  OTP_CODES: 'otp_codes',
  ADDRESSES: 'addresses',
  RESTAURANTS: 'restaurants',
  RESTAURANT_DOCUMENTS: 'restaurant_documents',
  RESTAURANT_OPERATING_HOURS: 'restaurant_operating_hours',
  CATEGORIES: 'categories',
  MENU_ITEMS: 'menu_items',
  CARTS: 'carts',
  CART_ITEMS: 'cart_items',
  ORDERS: 'orders',
  ORDER_ITEMS: 'order_items',
  ORDER_STATUS_HISTORY: 'order_status_history',
  PAYMENTS: 'payments',
  WEBHOOK_EVENTS: 'webhook_events',
  COUPONS: 'coupons',
  COUPON_USAGES: 'coupon_usages',
  REVIEWS: 'reviews',
  NOTIFICATIONS: 'notifications',
  BACKGROUND_JOBS: 'background_jobs',
  AUDIT_LOGS: 'audit_logs',
} as const;
export const SOCKET_ROOM = {
  USER: 'user',
  RESTAURANT: 'restaurant',
  ADMIN: 'admin',
} as const;
export const SOCKET_EVENT = {
  ORDER_CREATED: 'order.created',
  ORDER_ACCEPTED: 'order.accepted',
  ORDER_REJECTED: 'order.rejected',
  ORDER_PREPARING: 'order.preparing',
  ORDER_READY: 'order.ready',
  ORDER_OUT_FOR_DELIVERY: 'order.out_for_delivery',
  ORDER_DELIVERED: 'order.delivered',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  RESTAURANT_APPROVED: 'restaurant.approved',
  RESTAURANT_REJECTED: 'restaurant.rejected',
} as const;
export const ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  [OrderStatus.PENDING]: [
    OrderStatus.ACCEPTED,
    OrderStatus.REJECTED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.ACCEPTED]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.READY],
  [OrderStatus.READY]: [OrderStatus.OUT_FOR_DELIVERY],
  [OrderStatus.OUT_FOR_DELIVERY]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [OrderStatus.REFUNDED],
  [OrderStatus.REJECTED]: [],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};
