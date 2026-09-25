# Generated delivery-column migration recovery

## Cause and source fix

The reported migration failed while creating `deliveries`, with `AS (...) STORED UNSIGNED NULL`. TypeORM 0.3.27's MySQL query builder appends the unsigned modifier after the generated expression instead of as part of the numeric type.

The delivery entity now uses `DECIMAL(20,0)` for `active_partner_id`, without `unsigned`. This exact integer-valued helper can represent every unsigned BIGINT partner ID. The real `delivery_partner_id` foreign key is unchanged. The generated expression and unique index still enforce at most one active delivery per rider, while inactive deliveries return NULL.

Expected newly generated SQL has this shape:

```sql
`active_partner_id` DECIMAL(20,0) AS (
    CASE WHEN status IN (
        'ASSIGNED', 'ARRIVED_AT_MERCHANT', 'PICKED_UP',
        'OUT_FOR_DELIVERY', 'ARRIVED_AT_CUSTOMER'
    ) THEN delivery_partner_id ELSE NULL END
) STORED NULL
```

The forward migration `1790600000000-generated-partner-column.ts` aligns databases using the existing migration chain. Historical migration files are not rewritten. Do not remove the unique index or turn this into an ordinary writable column to bypass the syntax error.

## Your separate fresh-database checkout

The supplied error was from `D:\meal40\meal-backend` with one generated migration. The edited workspace is `C:\Meal40\meal-40-backend`, which retains the original migration chain. Changes here do not automatically modify the D: checkout.

1. Copy the corrected `libs/database/src/entities/deliveries/delivery.entity.ts` into the checkout where you generate migrations.
2. Preserve the failed generated file outside the migration discovery folder for reference. Only replace a failed/unapplied generated baseline, never an applied migration.
3. Generate the replacement baseline against a genuinely empty, separate test database. A failed MySQL schema migration can leave earlier tables behind despite ROLLBACK; do not generate a baseline against that partial schema.
4. Check the generated column uses `DECIMAL(20,0)` and does not contain `STORED UNSIGNED`.
5. Review the complete schema and migration list, then run the replacement migration against the empty test database.

```powershell
npm run migration:generate
npm run migration:show
npm run migration:run
```

These commands are instructions, not commands executed for this fix. No database was reset, no migration was generated or run, and no tests/builds were run.

## Important: entity generation is not a complete replacement for history

Deleting all migrations also removes custom SQL and seed data that entity generation cannot reconstruct. The previous migrations contain restaurant availability and merchant offer audit tables, search FULLTEXT indexes, a worker index, category seeds and email templates, among other changes. A generated baseline alone may run successfully yet leave application features broken.

Prefer the retained original chain plus the forward fix for a new database. If intentionally consolidating migrations in the other checkout, explicitly carry over the custom schema and seed operations into the new baseline or supplemental migrations. Do not run the full original chain alongside a generated full baseline: they both create the same tables.

Reference: [TypeORM 0.3.27 MySQL query builder](https://github.com/typeorm/typeorm/blob/0.3.27/src/driver/mysql/MysqlQueryRunner.ts), `buildCreateColumnSql`.
