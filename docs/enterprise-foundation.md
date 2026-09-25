# Enterprise foundation rollout

Implemented source scope: restaurant availability, basic menu controls, customer search, shared UI foundation, and selected order/delivery correctness fixes. This is not the complete enterprise roadmap and is not a production-readiness certification.

## Before deployment

No tests, builds, lint, type checks, servers, or migrations were run for this change, per the user's instruction. Runtime correctness, visual layout, and WCAG compliance remain unverified.

1. Back up the database and arrange a maintenance window. Use MySQL 8 (FULLTEXT and SKIP LOCKED are required). Inspect migration `1790300000000-availability-and-order-safety.ts` against the deployed schema. MySQL DDL is not fully transactional; plan recovery for a partially applied migration.
2. Configure a stable, independent `DELIVERY_OTP_SECRET` before migration and use the identical value in Main API. Empty/missing values fall back to `JWT_ACCESS_SECRET`. Changing the effective secret while deliveries are active makes their displayed/email codes unreadable; key-versioned rotation is not included.
3. Apply the migration using the existing deployment process before starting the updated backend. It adds schedules, audit history, delivery ciphertext, request idempotency fields, and search indexes. Index creation can lock large tables. It encrypts legacy notification codes and removes plaintext from those notifications. Down migration does not restore plaintext; active deliveries require special care during rollback.
4. Deploy both repositories together. Keep `ONLINE_PAYMENTS_ENABLED=false`: customer checkout now offers COD only. Do not turn this flag on until production checkout, refund handling, and reconciliation are implemented and verified.
5. Keep one realtime Main API instance until a shared Socket.IO adapter is configured. Durable publication does not guarantee that an offline client receives a socket event. Customer order/detail pages poll; database state remains authoritative.
6. Monitor failed `background_jobs` of types `realtime` and `delivery-otp-email`, processing age, email errors, and database deadlocks. Jobs have bounded retry/backoff; add operational alerting, replay tools, and retention before sustained production use. Email delivery may occur more than once after an uncertain failure.

## Availability contract

- `PATCH /api/v1/merchant/restaurants/:id/availability` accepts timezone, weeklyHours, exceptions, availabilityMode, optional overrideExpiresAt/reason, and expectedVersion. Ownership is checked, stale writes return 409, and successful saves create audit entries.
- Modes: SCHEDULED, FORCED_OPEN, FORCED_CLOSED. Expired overrides resume the schedule. Administrative approval and active state always take priority. Existing accepted orders continue when a store closes.
- Days are 0=Sunday through 6=Saturday. Intervals are start-inclusive/end-exclusive; a closing time before opening means overnight. Equal endpoints are invalid; represent 24-hour service using adjacent intervals. Exception dates replace the whole local date, including previous-day spillover; an empty exception closes the date.
- Legacy restaurants retain their stored manual status until settings are saved. An empty weekly schedule means closed in scheduled mode. Asia/Kolkata is the default. Timezones use IANA names; daylight-saving transition behavior needs targeted validation before non-India rollout.
- Menu items support manual availability, soldOutUntil, and optional weekly serviceHours. Empty item hours follow the restaurant; configured hours restrict ordering further. Cart increases and order creation recheck availability; checkout also enforces delivery radius and minimum order value. Menu updates/removals lock the restaurant to coordinate with checkout.

## Search and customer experience

- `GET /api/v1/search`: q, foodType, openNow, minimumRating, latitude/longitude, page, limit. Includes restaurant and matching-dish results with effective availability. Location filters delivery serviceability before the candidate cap.
- MySQL name prefix/FULLTEXT and category/city matching provide the initial search. Ranking favors open stores, exact/prefix names, matching dishes, distance, then rating. MySQL stopwords/minimum token lengths still apply. Typo tolerance, synonyms, cuisine taxonomy, and a dedicated search engine are deferred.
- Work is bounded to 1,000 restaurants and 5,000 matching dishes. `meta.truncated` reports the restaurant cap; totals are bounded result totals, not an exhaustive catalog count. A very large catalog requires a dedicated indexed search/read model. Dish matches are previews, not a complete menu.
- Shared warm orange/green tokens, visible focus, reduced-motion support, reusable hours controls, and search loading/empty/error states were added. Accessibility and responsive presentation still require manual verification.

## Safety improvements and remaining work

- Order creation accepts `Idempotency-Key`; the browser persists a retry key for the checkout attempt. Replay returns the prior order; different payloads using the same key return 409. Older clients without keys retain compatibility, not retry guarantees.
- Delivery acceptance serializes assignment, delivery completion persists order/history/earnings atomically, failed OTP attempts persist, and codes are encrypted at rest and stripped from normal responses. Only the owning customer's active-order response reveals a valid code. No code reissue flow is included yet.
- Reviews use authenticated backend storage and update ratings transactionally. Merchant review listing currently returns the latest 500 visible records. Existing mock review data is retained but not imported; the public file-writing route is retired.
- Payment capture verification checks provider amount/currency and avoids status downgrades. Provider-create uncertainty deliberately blocks duplicate creation and requires operator reconciliation. Automated reconciliation, refunds, settlements, and payment-ledger accounting remain deferred.
- Dispatch still offers orders to eligible online partners using the existing strategy; proximity waves, leases, timeouts, capacity management, reassignment, and SLA monitoring are not implemented here.
- Multi-outlet staff RBAC, advanced menu modifiers/inventory, bulk operations, admin command-center redesign, offline delivery UX, retention/replay tooling, load testing, and production observability are subsequent phases.
