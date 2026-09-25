# Menu, cuisine search and delivery workspace

## Changes

- Menu creation no longer requires seeded categories. An omitted/null category provisions the unique active `general` category during the merchant's write transaction. Public category reads remain read-only. Explicit missing/inactive categories produce a useful validation error. An existing disabled General category is not silently reactivated.
- Menu creation locks the owned restaurant; slug allocation includes soft-deleted items, preventing a reused dish name from colliding with retained records. Editing cannot transfer items to another store. Form validation covers prices, sale dates and preparation time.
- Cuisine enums are mirrored in backend contracts and frontend types. Restaurants and dishes store bounded cuisine arrays. Both create/edit forms expose cuisine selectors; existing unlabeled records remain valid. North Indian/South Indian are cuisines, separate from menu categories and vegetarian preferences.
- Customer search matches restaurant names, dish names/descriptions, category names, cities and cuisine labels, including partial phrases such as `south india`. Cuisine chips are search shortcuts, not separate intersecting filters. Search no longer requires the custom FULLTEXT indexes missing from a reset schema. Parameterized substring matching trades indexing performance for fresh-schema compatibility; it is not a replacement for a dedicated large-catalog search engine. Existing candidate/result bounds remain.
- Restaurant cards display cuisine labels. Merchant menu supports outlet/category filters and dish/cuisine text search; existing add/edit controls are preserved.
- Rider dashboard now has a themed overview, delivery progress steps, stage-aware map headings/navigation and retry feedback. After pickup, existing backend tracking targets the order's saved delivery address. Delivery actions invalidate tracking immediately; periodic polling remains the fallback. The map remains Google Static Maps, with external Google Maps navigation and opt-in foreground GPS, not native background tracking.
- Merchant marks accepted → preparing → ready; ready transactionally creates the delivery offer. An approved online rider accepts it, then manages arrival/pickup/out-for-delivery/customer-arrival and completion. The UI explains the merchant/rider handoff. This remains rider acceptance, not automatic nearest-rider assignment.
- Rider history is restricted to completed/cancelled deliveries. Existing active-assignment uniqueness, role checks, delivery OTP and COD cash confirmation remain enforced.

## Database rollout

Deploy both applications with the backend. New `cuisines` JSON columns are required in `restaurants` and `menu_items`. Merchant availability/offer audit entities are now registered so fresh entity-generated baselines include their tables instead of losing them when historical migrations are removed.

- Existing baseline installed: review/apply `1790800000000-cuisines-and-merchant-audit.ts`; it conditionally adds missing columns/tables without resetting data.
- Empty database: generate a complete baseline from the updated entities and ensure it executes before the supplemental migration. The supplemental migration is not a complete schema and fails explicitly if the base tables do not exist. Its timestamp/order must be reviewed if a later baseline is generated.
- Failed partial database: do not regenerate a complete baseline against partially created tables. Use a separate empty test database, preserving anything needed from the old one.
- The supplemental migration intentionally refuses automatic rollback to avoid deleting audit history or objects owned by a generated baseline. Use a reviewed recovery plan.
- This does not restore every removed seed migration, including email templates. Those remain a separate rollout prerequisite for email features.

The running checkout in the supplied logs was `D:\meal40\meal-backend`; this workspace is `C:\Meal40`. Copy all relevant backend/frontend changes, not just the delivery entity, if these are separate installations.

## Verification status

Source inspected only. No tests, builds, lint, type checks, migrations, servers or Google requests were run, per user instruction. The missing-category blocker is established from code and the fresh-DB workflow; any other runtime menu failure requires its actual API response to diagnose.

When testing is authorized, verify: first dish with zero categories; create/edit cuisine persistence; inactive category rejection; duplicate/soft-deleted dish names; restaurant/dish/cuisine searches; merchant ready → rider accept → pickup → drop-off route switch; competing rider acceptance; OTP/COD completion; and generated baseline audit tables.
