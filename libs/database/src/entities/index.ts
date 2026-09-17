import { AddressEntity } from './addresses/address.entity.js';
import { AuditLogEntity } from './audit-logs/audit-log.entity.js';
import { AuthSessionEntity } from './auth-sessions/auth-session.entity.js';
import { BackgroundJobEntity } from './background-jobs/background-job.entity.js';
import { CartItemEntity } from './cart-items/cart-item.entity.js';
import { CartEntity } from './carts/cart.entity.js';
import { CategoryEntity } from './categories/category.entity.js';
import { CouponUsageEntity } from './coupon-usages/coupon-usage.entity.js';
import { CouponEntity } from './coupons/coupon.entity.js';
import { MenuItemEntity } from './menu-items/menu-item.entity.js';
import { NotificationEntity } from './notifications/notification.entity.js';
import { OrderItemEntity } from './order-items/order-item.entity.js';
import { OrderStatusHistoryEntity } from './order-status-history/order-status-history.entity.js';
import { OrderEntity } from './orders/order.entity.js';
import { OtpCodeEntity } from './otp-codes/otp-code.entity.js';
import { PaymentEntity } from './payments/payment.entity.js';
import { RestaurantDocumentEntity } from './restaurant-documents/restaurant-document.entity.js';
import { RestaurantOperatingHourEntity } from './restaurant-operating-hours/restaurant-operating-hour.entity.js';
import { RestaurantEntity } from './restaurants/restaurant.entity.js';
import { ReviewEntity } from './reviews/review.entity.js';
import { UserEntity } from './users/user.entity.js';
import { WebhookEventEntity } from './webhook-events/webhook-event.entity.js';

export * from './addresses/address.entity.js';
export * from './audit-logs/audit-log.entity.js';
export * from './auth-sessions/auth-session.entity.js';
export * from './background-jobs/background-job.entity.js';
export * from './cart-items/cart-item.entity.js';
export * from './carts/cart.entity.js';
export * from './categories/category.entity.js';
export * from './coupon-usages/coupon-usage.entity.js';
export * from './coupons/coupon.entity.js';
export * from './menu-items/menu-item.entity.js';
export * from './notifications/notification.entity.js';
export * from './order-items/order-item.entity.js';
export * from './order-status-history/order-status-history.entity.js';
export * from './orders/order.entity.js';
export * from './otp-codes/otp-code.entity.js';
export * from './payments/payment.entity.js';
export * from './restaurant-documents/restaurant-document.entity.js';
export * from './restaurant-operating-hours/restaurant-operating-hour.entity.js';
export * from './restaurants/restaurant.entity.js';
export * from './reviews/review.entity.js';
export * from './shared/base.entity.js';
export * from './users/user.entity.js';
export * from './webhook-events/webhook-event.entity.js';

export const ENTITIES = [
  UserEntity,
  AuthSessionEntity,
  OtpCodeEntity,
  AddressEntity,
  RestaurantEntity,
  RestaurantDocumentEntity,
  RestaurantOperatingHourEntity,
  CategoryEntity,
  MenuItemEntity,
  CartEntity,
  CartItemEntity,
  CouponEntity,
  OrderEntity,
  OrderItemEntity,
  OrderStatusHistoryEntity,
  PaymentEntity,
  WebhookEventEntity,
  CouponUsageEntity,
  ReviewEntity,
  NotificationEntity,
  BackgroundJobEntity,
  AuditLogEntity,
] as const;
