# Meal40 end-to-end testing checklist

Test on a separate test database, not production. Use four accounts: customer, merchant, delivery partner, and admin. Use separate browser profiles so their logins do not overwrite one another. Add a second customer, merchant, and rider when checking ownership and concurrency.

This document records planned checks, not passing results. No tests, builds, migrations, or live provider calls were run when creating it.

## 1. Prepare and start the application

- [ ] Back up the database and confirm backend configuration points to the test database.
- [ ] Confirm project dependencies and required environment settings are available.
- [ ] Review pending migrations before applying them.

From `C:\Meal40\meal-40-backend`:

```powershell
npm run migration:show
npm run migration:run
```

The second command applies **all pending migrations**, including availability, tracking, and merchant offers. Apply them only after reviewing the list and confirming the target database. MySQL schema changes may partially commit; do not assume rollback will undo every migration operation.

Start these in separate terminals:

| Folder | Command |
| --- | --- |
| `C:\Meal40\meal-40-backend` | `npm run start:auth:dev` |
| `C:\Meal40\meal-40-backend` | `npm run start:main:dev` |
| `C:\Meal40\meal-40-frontend` | `npm run dev:customer` |
| `C:\Meal40\meal-40-frontend` | `npm run dev:dashboard` |

Use the configured URLs, normally customer `http://localhost:3000` and dashboard `http://localhost:3001`. Confirm both frontend origins are permitted by backend CORS configuration.

## 2. Merchant onboarding and availability

- [ ] Register a merchant and create a restaurant.
- [ ] Confirm it is not publicly orderable before admin approval.
- [ ] Approve and activate it using the admin account.
- [ ] Configure its location, delivery radius, opening hours, and minimum order.
- [ ] Add dishes and register a second outlet.
- [ ] Edit the first outlet and confirm its coordinates remain unchanged.

| Action | Expected result |
| --- | --- |
| Manually close restaurant | Customers cannot place new orders |
| Manually open restaurant | Ordering allowed if otherwise eligible |
| Use scheduled hours | Availability follows the configured timezone |
| Mark a dish unavailable | Checkout rejects that dish |
| Choose an address outside the radius | Checkout rejects delivery |
| Search by restaurant or dish name | Correct restaurant/dish appears |

## 3. Prices and offers with known numbers

Create this controlled setup:

- Dish A: base ₹200, active sale ₹160.
- Dish B: ₹100, no sale.
- Restaurant minimum: ₹200.
- Offer `TEST10`: 10% off, minimum ₹250, cap ₹30, entire menu, stacking enabled, active now, usage available.

Order one of each:

| Calculation | Expected |
| --- | ---: |
| Food subtotal | ₹260 |
| Dish savings, already included | ₹40 |
| Coupon discount | ₹26 |
| Food amount after coupon | ₹234 |

The final total should be **₹234 + configured tax + delivery fee + platform fee**. Do not subtract dish savings a second time.

Change one condition at a time, restoring the original setup between cases:

- [ ] Restrict the offer to Dish B: discount is ₹10.
- [ ] Disable stacking with dish sales: Dish A receives no additional coupon discount; Dish B remains eligible, giving ₹10 off.
- [ ] Set the cap to ₹20: original whole-menu discount becomes ₹20.
- [ ] Raise coupon minimum to ₹300: application fails.
- [ ] Pause or expire the offer: it no longer applies.
- [ ] Use another restaurant's code: reject it.
- [ ] Set per-customer usage to one: a second order using the same account and code fails.
- [ ] Schedule a dish sale: verify prices before, during, and after its active period.
- [ ] Verify active dish prices and original-price displays in menu/cart, and authoritative totals at checkout.

Current policy: cancelling an order does not restore coupon usage. Minimum spend is measured after dish sales, before coupon discounts; fees do not count toward minimum spend.

## 4. Checkout consistency

Keep customer checkout and merchant pricing open in separate browser profiles:

1. Customer loads checkout.
2. Merchant changes a dish price or offer.
3. Customer attempts to place the order with the old quote.

Expected: an outdated quote is rejected. The customer sees refreshed totals and must confirm again. If background polling already refreshed the quote, use a captured old quote in the test environment to exercise the rejection path reliably.

- [ ] Repeat the same order request with the same idempotency key: only one order is created.
- [ ] Reuse that key with different order inputs: reject the request.
- [ ] Change a dish price after ordering: the existing order retains its recorded price.
- [ ] Have two customers compete for the last coupon use: at most one redeems it.
- [ ] Close the restaurant during checkout: prevent a new order.
- [ ] Confirm a failed order does not consume coupon usage or remove the cart.
- [ ] Confirm successful ordering clears the checked-out cart, not an unrelated outlet's cart.

Checkout periodically refreshes quotes, so waiting five minutes on the page does not reliably test expiry. Resubmit a captured expired quote against the test environment instead. A quote does not reserve stock, restaurant availability, or coupon capacity.

## 5. Delivery end to end

Complete one COD order:

- [ ] Customer places the order.
- [ ] Merchant accepts, prepares, and marks it ready.
- [ ] Approved, available rider accepts an assignment when offered.
- [ ] Rider enables location sharing.
- [ ] Rider progresses through arrival at store and pickup.
- [ ] Rider arrives at the customer.
- [ ] Customer provides the delivery OTP.
- [ ] Rider confirms cash collection and completes delivery.

Verify:

- [ ] Before pickup, the plotted route targets the restaurant.
- [ ] After pickup, it targets the saved delivery address.
- [ ] Customer, owning merchant, assigned rider, and admin can view authorized tracking.
- [ ] Wrong OTP or missing cash confirmation prevents completion.
- [ ] The rider cannot hold two active deliveries.
- [ ] Completion updates order/payment status and removes live rider location.
- [ ] Denied GPS permission, offline GPS publishing, or a map-provider failure shows a useful fallback without blocking valid order actions.
- [ ] Stale location is labelled stale, not represented as current live tracking.

Use a phone over **HTTPS** for real GPS testing. Localhost is a development exception, but an ordinary LAN HTTP address on a phone is not localhost. Keep the rider app open.

Current tracking is a refreshing plotted map, not continuous background tracking or embedded interactive navigation. Enable the configured Google Routes and Maps Static APIs, billing, and suitable server-key restrictions before provider checks. Never expose the server key in browser code. Provider calls may incur charges.

## 6. Refresh-token recovery

Open browser developer tools → Network and enable Preserve log:

1. Log in normally.
2. Let the access token expire; a short lifetime may be configured in the test environment only.
3. Trigger an authenticated request.

Expected sequence:

```text
Original request → 401
Refresh request → success
Original request retried → success
```

- [ ] Several simultaneous failed requests share refresh work.
- [ ] The original request retries only once, preserving its request body and idempotency key.
- [ ] Expired or revoked refresh credentials require login.
- [ ] Permission-denied 403 responses do not trigger refresh.
- [ ] Logging out during refresh does not restore the session.
- [ ] Changing user identity prevents an old failed request replaying as the new user.
- [ ] Network failure during refresh does not erase login credentials.
- [ ] Same-origin tabs coordinate refresh where Web Locks are available.

Same-origin coordination does not guarantee coordination across separate origins or browsers without Web Locks. Do not share screenshots or exported network logs containing tokens, cookies, OTPs, or private customer data.

## 7. Permissions and UI

- [ ] Another customer cannot read an order they do not own.
- [ ] Another merchant cannot edit the store, dishes, or offers they do not own.
- [ ] An unassigned rider cannot publish location or read private tracking for that order.
- [ ] A merchant cannot self-approve a store or grant themselves delivery/admin privileges.
- [ ] Stale concurrent offer edits fail instead of silently overwriting newer terms.
- [ ] Mobile and desktop layouts show loading, empty, error, retry, disabled-button, and success states clearly.
- [ ] Validation messages explain why checkout or an offer is rejected.
- [ ] Customer order detail shows the saved discount and total consistently with checkout.

All unauthorized requests must fail without exposing private data. Hiding a button alone is not proof of backend authorization.

## 8. Release checks and results

Before production, run the existing builds, type checks, and automated tests in the test environment. The commands below are instructions only; they were not run for this document.

Backend (`C:\Meal40\meal-40-backend`):

```powershell
npm run build
npm run lint
npm test
npm run test:e2e
```

Frontend (`C:\Meal40\meal-40-frontend`):

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Existing suites may not cover every new case above. Record manual results and add regression coverage for critical pricing, authorization, refresh, and concurrent-order behavior before release.

| Case | Expected result | Actual result | Pass/fail | Issue/reference |
| --- | --- | --- | --- | --- |
| Merchant registration and approval | Pending until approved | | | |
| Schedule/manual availability | Correct ordering eligibility | | | |
| Dish sale and coupon pricing | Matches controlled calculations | | | |
| Stale/expired quote | Rejected; customer confirms new total | | | |
| Idempotency/concurrent coupon usage | No duplicate order or excess redemption | | | |
| COD delivery and tracking | Correct route, OTP, cash and completion | | | |
| Refresh and request replay | One retry; safe session handling | | | |
| Ownership checks | Unauthorized access rejected | | | |
| Responsive UI and failure states | Usable and accurate | | | |

A successful manual order alone does not establish enterprise readiness. Online payment, native background tracking, advanced dispatch, refunds/settlements, and other documented release gaps require separate work and validation.

## References

- [Merchant pricing and rollout](merchant-pricing-offers.md)
- [Tracking, authentication, and order-flow limitations](tracking-auth-order-rollout.md)
- [Enterprise foundation](enterprise-foundation.md)
