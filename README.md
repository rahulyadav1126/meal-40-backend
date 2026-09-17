# Plate40 backend

Production-oriented NestJS monorepo for Plate40, an affordable food-ordering platform. It contains independently runnable authentication and business APIs backed by MySQL and TypeORM. Redis, Prisma, deployment manifests, and frontend code are intentionally excluded.

## Applications

| Application | Port | Responsibility |
|---|---:|---|
| `auth-api` | 4001 | Registration, login, JWT access/refresh tokens, session revocation, OTP persistence and health |
| `main-api` | 4002 | Restaurants, menu, cart, addresses, orders, payments, reviews, notifications, merchant/admin operations and realtime events |

Both ports are configurable. Both APIs use `/api/v1`, publish Swagger at `/docs`, validate all DTOs with a whitelist, use Pino request correlation, Helmet, CORS, throttling, consistent response/error envelopes, and graceful shutdown hooks.

## Shared libraries

- `contracts`: the single source of truth for domain enums, constants, JWT/API types, event names and order-transition policy.
- `auth`: shared JWT strategy, global JWT/RBAC guards and `@Public`, `@CurrentUser`, and `@Roles` decorators.
- `common`: response/error infrastructure, pagination, integer-safe money arithmetic and Haversine distance calculations.
- `config`: validated environment configuration.
- `database`: TypeORM configuration, entities and migrations. Runtime schema synchronization is disabled.
- `integrations`: replaceable maps, file-storage, email and SMS provider contracts, including Cloudinary and Nodemailer implementations.

## Major modules

### Identity and sessions

Owns `users`, `auth_sessions`, and `otp_codes`. It exposes register, login, refresh-token rotation, current/all-device logout, active-session listing and revocation. Passwords, refresh tokens, and OTPs are Argon2 hashes. Access JWTs contain only `sub`, `role`, and `sessionId`. Registration permits customer and merchant accounts; restaurant approval remains an independent business state.

### Restaurants and menu

Owns restaurants, documents, operating hours, categories, and menu items. Public queries only return approved, active restaurants. Merchant mutations enforce ownership server-side. Menu prices use `DECIMAL(10,2)`, and menu deletion is soft. Admin approval actions are RBAC protected and audited.

### Cart and orders

Owns carts, cart items, orders, immutable order-item snapshots, and status history. Cart pricing is always loaded from the database. Order placement runs in one TypeORM transaction: it locks and validates the cart, restaurant, delivery address/radius, items and coupon; calculates totals; stores snapshots/history; records coupon use; and clears the cart. Realtime `order.created` is emitted only after commit.

Order transitions are defined once in `libs/contracts/src/constants.ts`; controllers cannot arbitrarily assign statuses. Merchant ownership and customer cancellation rules are enforced in services.

### Payments

Owns payments and webhook events. Razorpay order creation converts server-calculated decimal money to integer paise. Client verification and webhooks use timing-safe HMAC comparison. Webhook event keys are unique and processed transactionally for idempotence; frontend success claims are never trusted alone.

### Reviews, notifications and administration

Reviews require a delivered order and are unique per order. Notifications support per-user read state. Admin endpoints require the admin role and support dashboard statistics, restaurant approval/rejection/suspension, and user block/unblock. Sensitive mutations write immutable audit logs.

### Realtime and integrations

Socket.IO connections authenticate with the shared access JWT and join typed `user:{id}`, `restaurant:{id}`, or `admin` rooms. The current adapter targets one backend instance and is isolated for later broker replacement. External maps, storage, mail, SMS and payment concerns stay behind provider boundaries.

## Setup

1. Copy `.env.example` to `.env` and set MySQL and JWT values. Secrets must be at least 32 characters.
2. Install dependencies with `npm install`.
3. Create the MySQL database and run `npm run migration:run`.
4. Start the APIs with `npm run start:auth:dev` and `npm run start:main:dev`.

Useful commands:

```text
npm run build
npm run lint
npm test
npm run migration:run
npm run migration:revert
npm run migration:show
npm run migration:generate
```

`npm run migration:generate` compares all registered entities against the current MySQL schema and automatically creates a timestamped `*-AutoMigration.ts` file. No migration path or name argument is required. Apply all existing migrations before generating the next migration.

## Entity and migration organization

Every database table has an isolated entity folder and file under `libs/database/src/entities`, for example:

```text
entities/
├── users/user.entity.ts
├── restaurants/restaurant.entity.ts
├── menu-items/menu-item.entity.ts
├── orders/order.entity.ts
├── order-items/order-item.entity.ts
├── payments/payment.entity.ts
└── shared/base.entity.ts
```

Migrations use TypeORM's dedicated `migration_history` table. A row is inserted only after a migration completes successfully, so the table tracks every applied migration by ID, timestamp, and name. `npm run migration:show` displays applied and pending migrations. The admin-protected `GET /api/v1/health/migrations` endpoint returns the complete applied history, the last successfully applied migration, and whether pending migrations exist. TypeORM transaction mode is set to `all`; note that MySQL may implicitly commit some DDL statements.

## Main endpoints

- Auth: `POST /api/v1/auth/register`, `/login`, `/refresh`, `/logout`, `/logout-all`; `GET /api/v1/auth/sessions`; `DELETE /api/v1/auth/sessions/:id`.
- Public catalog: `GET /api/v1/restaurants`, `/restaurants/:id`, `/restaurants/:id/menu`, `/categories`.
- Customer: address CRUD, cart operations, order create/list/get/cancel, reviews, and notifications.
- Merchant: restaurant CRUD, menu CRUD, order list and explicit accept/reject/preparing/ready/out-for-delivery actions.
- Payments: `POST /api/v1/payments/razorpay/create`, `/verify`, and public signature-verified `/webhook`.
- Admin: dashboard, restaurants, orders, users, restaurant moderation, and user block/unblock.

## Security notes

- Never commit `.env`, credentials, JWTs, OTPs, payment secrets or authorization headers.
- Production CORS origins must be explicit.
- Keep MySQL timestamps in UTC and perform display timezone conversion in clients.
- Horizontal Socket.IO scaling requires introducing a broker/adapter; none is configured by design.
- Run `npm audit` as part of dependency review. Do not apply forced major upgrades without compatibility testing.
