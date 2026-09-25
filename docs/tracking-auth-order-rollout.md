# Tracking, auth, and order-flow hardening

Source implementation only. At the user's request, no tests, builds, lint, type checks, database migrations, or running-app checks were performed. No Google API requests were made to validate the configured key. Do not treat this as a certification that every screen or production deployment works.

## Deployment prerequisites

- Apply the earlier availability/order-safety migration first, then `1790400000000-tracking-and-assignment.ts`, after backup and schema review. Deploy both frontend and backend changes together. Do not run against an unknown database.
- The new migration refuses to continue if a rider already has multiple active deliveries. Resolve those assignments operationally; it does not cancel user orders. It adds a database-enforced single-active-assignment constraint, private latest-location JSON, immutable address snapshots, and a worker lookup index. MySQL DDL can partially commit: plan backup/recovery, not an assumption of transactional rollback.
- Legacy address snapshots use the address currently stored at migration time. Historic addresses that were previously edited cannot be reconstructed automatically. New orders snapshot the address at checkout.
- Keep the existing `GOOGLE_MAPS_API_KEY` in Main API's server environment. Enable **Routes API** and **Maps Static API** with billing/quota and server-IP/application restrictions appropriate for server requests. Do not copy a server key into a browser environment. The existing Places API configuration remains separate. No real environment files were edited.
- The implementation uses Google's Routes API road polyline and Maps Static imagery, refreshed approximately every 20 seconds. It is a refreshing plotted map, not an embedded draggable Maps JavaScript map. Interactive turn-by-turn navigation opens Google Maps. Provider failures leave the order workflow usable and display a fallback, never a fabricated route or ETA.
- Both application origins must be allowed by backend CORS configuration. Rider geolocation requires HTTPS (localhost is a development exception), permission, and an open app. Native mobile background tracking is not implemented.

Google references: [Routes API](https://developers.google.com/maps/documentation/routes/compute_route_directions), [Maps Static API](https://developers.google.com/maps/documentation/maps-static/start).

## Flow and endpoint mapping

| Flow | Backend | Frontend |
| --- | --- | --- |
| Customer order and items | `GET /orders/:id` | Customer order detail, item list, status, OTP |
| Customer cancellation | `PATCH /orders/:id/cancel` | Cancel button for pending orders; server arbitrates acceptance races |
| Store order and items | `GET /merchant/orders`, `GET /merchant/orders/:id` | Kitchen cards and real merchant detail page; placeholder/redirect removed |
| Store state actions | `PATCH /merchant/orders/:id/{accept,reject,preparing,ready}` | Queue/detail actions with failures shown |
| Admin order detail | `GET /admin/orders/:id` | Real admin detail page with tracking |
| Rider assignment and progress | Existing `POST /delivery/:id/...` actions | Available/active delivery cards and cash confirmation |
| Rider location | `POST /tracking/deliveries/:id/location` | Layout-level opt-in GPS publisher every ~5 seconds |
| Authorized tracking | `GET /tracking/orders/:id` | Customer, merchant, rider and admin map views; polling every ~10 seconds |
| Session logout | `POST /auth/logout` | Both application logout controls call backend before local cleanup |
| Refresh rotation | `POST /auth/refresh` | Same-tab single-flight plus same-origin Web Locks where supported |
| Email OTP | `POST /auth/otp/request`, `/verify` | Backend email-verification support; no new OTP onboarding screen in this change |

All paths are under `/api/v1`. Route ownership/role checks are enforced server-side. Map responses are private/no-store and the server API key never leaves the backend. Coordinates are not sent in socket broadcasts or durable jobs.

## Database and consistency decisions

- A generated nullable `active_partner_id` unique index enforces one active delivery per rider. Existing unique delivery-per-order and earning-per-delivery indexes remain in place.
- Acceptance and availability changes lock the rider; rejecting an offer locks the delivery. Order creation already serializes customer/cart access and validates menu state, price, minimum value, and delivery radius. Address reads now lock before snapshotting.
- Store order lists/detail now include persisted order-item snapshots. Cart selection is carried to checkout explicitly instead of silently choosing the first cart. Pending cancellation is wired to the customer UI.
- COD completion requires `cashCollected: true` as well as the customer OTP and advances payment status with order/delivery/earning changes atomically. This is a collection confirmation, not a full cash-settlement ledger.
- A fresh delivery OTP is generated on first arrival at the customer, with a 30-minute expiry; retrying the same transition does not rotate it again. It is still encrypted and only the customer can read it. Manual code reissue after expiry/exhaustion remains operational follow-up work.

## Privacy and tracking behavior

- Only the assigned rider can publish while the delivery is active. Coordinates and accuracy are validated; old/out-of-order samples are ignored, requests closer than four seconds are ignored, and samples older than one minute or significantly future-dated are rejected.
- Viewer access is limited to the ordering customer, owning merchant, assigned rider, and admin. Unassigned offers no longer expose customer identity/address details.
- The plotted route targets the store before pickup and the delivery-address snapshot after pickup. Locations older than 90 seconds are labelled stale and are not used for a live ETA. No straight-line substitute is represented as a road route.
- Only the latest rider location is stored; no GPS-history table is introduced. Completion/cancellation clears it. Provider results are cached in bounded process memory for 20 seconds, never as a permanent image archive.
- GPS is device-reported, not fraud-proof. Browser background suspension, GPS spoofing, multi-device rider arbitration, regional serviceability/dispatch ranking and full retention policy still need dedicated work.

## Authentication hardening

- HTTP access verifies the current user is active and the session is present, unexpired and unrevoked. Authorization uses the current database role, not only stale JWT claims. HS256 is explicitly selected.
- Socket connection validates the same session/user, and existing connections are rechecked every 30 seconds, including token expiration. HTTP polling provides fallback when a socket disconnects.
- Refresh rotation takes a row lock, emits unique refresh JWT IDs and revokes the affected session on reuse. Frontend refresh does not recursively retry itself, overwrite a newer/logout session, or clear credentials on transient network errors. Same-origin browser tabs use Web Locks where available; older browsers and separate origins do not have that coordination guarantee.
- Logout failures are surfaced rather than claiming server revocation succeeded. JWTs/refresh tokens still use the existing browser storage contract; an HttpOnly-cookie/BFF migration, MFA, distributed throttling and abuse detection remain future security work.
- Email OTP generation now uses cryptographic randomness, per-identifier cooldown, SMTP delivery, transactional one-time verification and persistent attempt limits. Unsupported login/reset/phone/delivery purposes on the generic OTP endpoint fail explicitly instead of reporting a code sent with no provider/workflow. Dedicated delivery OTP endpoints are unchanged except cash confirmation/fresh-arrival code.

## Remaining release gates

Source inspection covered changed paths and their consumers, not a proof of all app behavior. Before production release (when authorized), validate migrations against a copy, role/ownership boundaries, refresh races, GPS permissions/offline recovery, provider restrictions, visual responsiveness/accessibility, order concurrency, and payment reconciliation. Online payment remains disabled. Multi-server socket delivery, reliable native background tracking, advanced dispatch, refunds/settlements, full pagination at scale, and automated operational alerting are not completed by this change.
