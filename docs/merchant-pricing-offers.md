# Merchant pricing and checkout

## Rollout

Apply `1790500000000-merchant-offers` after the existing availability and tracking migrations before deploying the changed APIs/UI. It adds scheduled dish prices, restaurant-scoped coupons, optimistic offer versions, offer audit history, and order price/offer snapshots. No migrations, tests, builds, or live requests were run for this implementation, as requested. Source review is not production certification; staging validation remains a deployment gate.

## Owner workflow

Merchant signup leads to store settings. Owners can register multiple outlets; new outlets still require platform approval. Store settings control minimum order, delivery radius, schedules and manual opening/closing. Editing a store preserves its existing coordinates.

The menu editor controls base prices and optional sale prices with optional start/end timestamps (entered in the browser's local time, stored as instants). This is owner-managed pricing, not demand-based surge pricing. Public menu, dish search, cart and checkout use the server's active sale price.

The dashboard's Offers & pricing page creates and edits restaurant-specific codes: fixed/percentage discounts, selected dishes or the whole menu, minimum food subtotal, optional cap, active dates, total/per-customer limits and whether already-discounted dishes are eligible. Owners can pause/resume offers. Codes are globally unique; stale updates fail with 409. Owners cannot edit another restaurant's offers or platform-wide coupons. Categories remain the existing shared catalog.

## Order rules

- `POST /orders/quote` uses the same ownership, availability, delivery-radius, usage-limit and pricing checks as order creation, without creating an order or consuming a coupon.
- Minimum spend is the food subtotal after dish sale prices, before the coupon. Restaurant minimum and coupon minimum are both enforced. Fees do not count toward minimum spend.
- One coupon per order. Percentage/fixed discounts apply only to eligible food, never exceed that food subtotal, and respect the optional discount cap. Taxes and platform/delivery fees remain platform configuration, not owner privileges.
- Checkout shows the authoritative breakdown and passes a signed five-minute quote. Changed prices/offer terms or an expired quote require the customer to review the refreshed total and confirm again. Legacy API callers without a quote still receive server-calculated prices.
- Creation locks the restaurant and coupon, checks usage transactionally, records immutable price/offer snapshots and supports idempotent retries. A quote does not reserve inventory, availability or coupon capacity.
- Existing coupon usage is consumed on order creation; cancellation does not automatically restore it. Refunds and usage restoration require a separate explicit policy.
- Legacy coupons with no restaurant remain platform-wide. Existing orders have no retroactively reconstructed offer snapshots.

## Authentication and delivery boundaries

The shared API client retries an original 401 request once after access-token refresh, sharing refresh work between concurrent requests and coordinating same-origin tabs where Web Locks exist. It does not retry permission-denied 403 responses, aborted requests or requests whose user identity changed. Expired/revoked refresh credentials clear the local session and require login; transient refresh failures do not silently log the user out. Tokens remain in existing local storage: HttpOnly-cookie migration and cross-origin session design remain separate security work.

Merchant registration does not grant approval or delivery-partner privileges. Delivery partners use their existing registration/approval and assignment flow; see `tracking-auth-order-rollout.md`. This change does not introduce owner-controlled rider onboarding, payouts, settlements, automatic surge pricing or arbitrary tax rules.
