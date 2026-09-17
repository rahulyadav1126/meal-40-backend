import {
  DEFAULT_AUTH_API_PORT,
  DEFAULT_MAIN_API_PORT,
  DEFAULT_MAX_PAGE_LIMIT,
  Environment,
} from '@app/contracts';

export const configuration = () => ({
  app: {
    environment: process.env.NODE_ENV ?? Environment.DEVELOPMENT,
    authPort: Number(process.env.AUTH_API_PORT ?? DEFAULT_AUTH_API_PORT),
    mainPort: Number(process.env.MAIN_API_PORT ?? DEFAULT_MAIN_API_PORT),
    corsOrigins: (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean),
    paginationMaxLimit: Number(
      process.env.PAGINATION_MAX_LIMIT ?? DEFAULT_MAX_PAGE_LIMIT,
    ),
  },
  database: {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    username: process.env.MYSQL_USERNAME,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  otp: {
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES ?? 10),
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  },
  pricing: {
    deliveryFee: process.env.DEFAULT_DELIVERY_FEE ?? '0.00',
    platformFee: process.env.DEFAULT_PLATFORM_FEE ?? '0.00',
    taxRatePercent: process.env.DEFAULT_TAX_RATE_PERCENT ?? '0',
  },
});
