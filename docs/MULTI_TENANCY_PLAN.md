# Multi-tenancy plan

The earlier draft in this file recommended one deployment per restaurant. That recommendation is superseded. The product is a shared-database SaaS: one Postgres schema, `restaurantId` on every tenant-owned table, application scoping plus PostgreSQL row-level security, and a separate platform panel for the operator. `Restaurant` is the tenant. A second `Tenant` model is not needed: the row already exists, business tables already point at it, and the missing pieces are identity fields, coverage, and enforcement.

Prerequisite check: production boots `createApp()` from `backend/src/index.ts`. Route tests and `scripts/generate-route-table.ts` use the same function. There is no second mount path.

## 1. Model inventory

Classification:

- **TENANT_ROOT** — the tenant record itself. No `restaurantId` column.
- **TENANT_OWNED** — row belongs to one restaurant. Must have `restaurantId`.
- **CHILD** — tenant-owned, previously reachable only through a parent. Gains its own `restaurantId` so row-level security does not depend on a join.
- **PLATFORM** — operator data. Not readable through the tenant client. A `restaurantId` foreign key, when present, names the subject tenant.

| Model | Class | Today | Why |
| --- | --- | --- | --- |
| Restaurant | TENANT_ROOT | no `restaurantId` | The tenant. Allowlisted. |
| Branch | TENANT_OWNED | has `restaurantId`; unique `(restaurantId, code)` | Location of a tenant. |
| User | TENANT_OWNED | has `restaurantId`; `email` globally unique; `phone` not unique | Staff and customers belong to one tenant. Same email or phone may exist in another tenant. |
| Category | TENANT_OWNED | has `restaurantId`; `name` globally unique | No slug column. `name` is the unique key and becomes `(restaurantId, name)`. |
| MenuItem | TENANT_OWNED | has `restaurantId`; no slug, `sku` not unique | Dishes. No slug to convert. |
| StoreSettings | TENANT_OWNED | has unique `restaurantId`; `id` defaults to `"default"` | One settings row per tenant. Existing primary key `default` stays for tenant #1 so current lookups keep working. New tenants use their restaurant id as the settings id. |
| PromoBanner, Deal, DeliveryArea, DeliveryPause, Order, OrderBlock, Testimonial, Coupon, Supplier, InventoryItem, IngredientCategory | TENANT_OWNED | already have `restaurantId` | Direct business data. Coupon code is already unique per restaurant. |
| BranchPosOrderDayCounter, BranchTaxInvoiceCounter, BranchMember, DiningFloor, DiningTable, TableSession, Reservation, WaitlistEntry, PrintStation, CashShift, RiderCashEntry, RiderSettlement, PosHold, StockMovement, StockBatch, InventoryPurchase, WasteLog, StockCount, SupplierPayment, BranchStock | CHILD | parent `branchId` only | Branch-scoped operations. |
| AuditLog | CHILD | optional `branchId` | Must be tenant-scoped even when no branch is set. |
| EmailLog | CHILD | `reservationId` | Booking mail log. |
| MenuItemBranchAvailability, MenuRecipe, RecipeLine, MenuItemOptionGroup, MenuItemSize, MenuItemAddon, DealItem, DealBranchAvailability | CHILD | menu or deal parent | Catalog children. |
| MenuItemOption | CHILD | option group | Stamped from the group after the group is stamped. |
| SupplierItem | CHILD | supplier | |
| InventoryPurchaseLine, StockCountLine, StockTransferLine | CHILD | purchase, count, or transfer | |
| StockTransfer | CHILD | `fromBranchId` | Both branches are the same tenant. |
| DeliveryAreaBranch | CHILD | composite key `(areaId, branchId)` | |
| OrderPayment, OrderFeedback, OrderEvent, OrderItem, KotPrintLog | CHILD | `orderId` | |
| CashMovement | CHILD | `shiftId`; `posClientMovementId` globally unique | Idempotency key becomes composite. |
| CustomerPushSubscription | CHILD | optional `userId`; `endpoint` globally unique | Endpoint is a browser URL and stays globally unique. `restaurantId` is still stored. |
| StaffPushSubscription | CHILD | `userId`; `endpoint` globally unique | Same as customer push. |
| CustomerAdminProfile | CHILD | `directoryId` is the customer user id | Staff notes about a customer. |
| Invoice | CHILD | optional `orderId`; `invoiceNumber` globally unique | Tax invoice numbers become unique per tenant. |
| RestaurantNote | PLATFORM | new | Operator notes. Has `restaurantId` so a tenant session cannot read another tenant's notes. Tenant APIs do not expose it. |
| TenantCounter | TENANT_OWNED | new | Gap-free sequences with row locks. |

Enums are not tables.

### Unique keys that change

| Key | Change |
| --- | --- |
| `User.email` | `(restaurantId, email)` |
| `User.phone` | partial unique `(restaurantId, phone)` where phone is non-empty (column was not unique) |
| `Category.name` | `(restaurantId, name)` |
| `Order.orderNumber` | `(restaurantId, orderNumber)` |
| `Order.checkoutIdempotencyKey` | `(restaurantId, checkoutIdempotencyKey)` |
| `Order.posClientOrderId` | `(restaurantId, posClientOrderId)` |
| `Invoice.invoiceNumber` | `(restaurantId, invoiceNumber)` |
| `Reservation.idempotencyKey` | `(restaurantId, idempotencyKey)` |
| `CashMovement.posClientMovementId` | `(restaurantId, posClientMovementId)` |
| `DeliveryArea.slug` | partial unique `(restaurantId, slug)` where slug is non-empty. Empty slug is the default and must stay repeatable. |
| `Coupon (restaurantId, code)`, `Branch (restaurantId, code)`, dining table `(branchId, label)` | already safe |
| `Order.guestAccessToken`, `Reservation.confirmationToken`, push `endpoint` | stay globally unique. They are secrets or browser URLs, not business keys. |

`StoreSettings.id = 'default'` remains only for the original restaurant. It is not a second tenant's key.

### Raw SQL

| Location | Use |
| --- | --- |
| `backend/src/lib/inventory/ledger.ts` | `SELECT … FROM "BranchStock" … FOR UPDATE` |
| `backend/src/lib/db-health.ts` | `SELECT 1` connectivity probe |

No other `$queryRaw` / `$executeRaw` call sites.

### Counters and sequences

| Sequence | Today | Target |
| --- | --- | --- |
| Online order numbers | `nextOrderNumber()` reads the latest `orderNumber` | `TenantCounter` name `order`, row lock |
| POS order numbers | `BranchPosOrderDayCounter` upsert per branch per day | Same format, allocated through `TenantCounter` (`pos_order`) and mirrored onto the old row |
| Tax invoices | `BranchTaxInvoiceCounter` per branch per fiscal year | `TenantCounter` name `invoice` |
| KOT | print count only, no sequence | `TenantCounter` name `kot`, stored on `KotPrintLog.kotNumber` |
| Cash shifts | no number | `TenantCounter` name `shift`, stored on `CashShift.shiftNumber` |

### Sockets

`backend/src/lib/realtime.ts`. Rooms today: `ops`, `branch:{branchId}`, `rider:{userId}`, `customer:{userId}`, `user:{userId}`, `order:{orderId}`. Handshake checks the JWT but does not carry a tenant id. Task 2 moves rooms to `t:{tenantId}:b:{branchId}`.

### Uploads

`backend/src/lib/uploads.ts` writes into one `UPLOAD_DIR` with generated filenames. Paths are not tenant-prefixed. Task 2 adds a per-tenant prefix and redirects for files already on disk.

### Caches and ISR

- `frontend/src/app/layout.tsx` and `manifest.ts` fetch `/settings/public` with `revalidate: 30` / `60` and no tenant in the cache key.
- `frontend/src/app/api/revalidate-store/route.ts` calls `revalidatePath` for `/` and `/menu` only.
- Delivery-area public cache in `backend/src/lib/delivery/public-cache.ts` is process memory, not keyed by tenant.
- No `generateStaticParams`.

### Schedulers (in-process)

Started from `index.ts`:

- Dine-in jobs (`backend/src/lib/dine-in/jobs.ts`): no-shows, expiry, reminders, follow-ups, email queue. Every 60s.
- Analytics email and daily closeout (`backend/src/lib/analytics/scheduled-email.ts`). Every 15 minutes.

No separate auto-cancel worker and no push-subscription cleanup job. Both schedulers assume one restaurant. Task 2 iterates tenants under a Postgres advisory lock.

### Email

`backend/src/lib/email.ts` uses one SMTP configuration from the environment. Templates include the store name from settings. No per-tenant sender, reply-to, or rate limit yet.

### Public endpoints

Mounted in `createApp()` without staff auth: `/health`, `/menu`, `/categories`, `/deals`, `/delivery-areas`, `/settings`, `/coupons` (public router), `/branches`, `/dine-in` (public router), `/orders` (checkout and tracking), `/upload` static files under `/uploads`. Task 9 walks these.

### `RESTAURANT_ID` and `resolveRestaurantId`

| Place | Behavior today |
| --- | --- |
| `backend/src/lib/restaurant-context.ts` | Fallback `RESTAURANT_ID` or `11111111-1111-4111-8111-111111111111`. Async local storage is optional. |
| `backend/src/lib/prisma.ts` `resolveRestaurantId` | Env id wins over hostname. Hostname cache. Else fallback. |
| `backend/src/app.ts` | Middleware calls `resolveRestaurantId(req.hostname)` and `runWithRestaurant`. |
| `backend/src/lib/settings-data.ts` | Uses `getRestaurantId()`. Settings id is `default` only for the original restaurant. |
| `backend/src/routes/delivery-areas.ts`, `backend/src/lib/delivery/mutations.ts`, `backend/src/lib/inventory/seed-demo.ts` | Hardcoded original restaurant id. |
| `backend/prisma/seed.ts` | Hardcoded original id for the upsert of that row. |
| `backend/.env.example`, `README.md`, `docs/RECON.md`, `docs/DECISIONS.md`, `docs/RESTAURANT-OS-AUDIT.md` | Document env id as the deployment tenant. README is updated in Task 10. |

The Prisma extension only lists 12 models (`User`, `Category`, `MenuItem`, `StoreSettings`, `PromoBanner`, `Deal`, `DeliveryArea`, `Order`, `OrderBlock`, `Testimonial`, `Supplier`, `InventoryItem`). Creates spread `restaurantId` before caller data, so a caller can override the tenant. `findUnique` with a `select` that omits `restaurantId` does not filter.

### `NEXT_PUBLIC_*`

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_ENABLE_DEMO_LOGIN`. None of them identify a tenant. The Next rewrite `/api/proxy/:path*` forwards to `API_PROXY_TARGET` and does not pass the browser `Host`. Task 2 adds a shared-secret forwarded-host header.

## 2. Migration order

Rehearsed on a copy of the local database (`restaurant_os_mt_rehearsal`), not on the working database. The working database still has no `slug` column.

Copy size (live row estimates before the migration): AuditLog 402, MenuItemBranchAvailability 254, OrderItem 247, User 153, StockMovement 144, RecipeLine 129, Order 115, BranchMember 63, MenuItem 46, InventoryItem 45, and smaller tables down to one Restaurant row.

| Migration | Time on this copy |
| --- | --- |
| `20261023120000_tenant_data_layer` | 0.49s |
| `20261023120100_row_level_security` | 0.10s |

Afterward: Restaurant slug `main`, status `ACTIVE`. Order 115/115 with `restaurantId`. AuditLog 402/402. 80 audit rows took the branch's restaurant; 322 had no branch and were assigned to tenant #1. `TenantCounter` seeded 11 POS-day rows. As `restaurant_app` with `app.tenant_id` set to tenant #1, `Order` returned 115 rows and 0 rows for any other restaurant.

The first rehearsal attempt failed and rolled back: `AuditLog` is append-only, so the backfill disables that trigger for the update and turns it back on. A mistaken `prisma migrate deploy` against the working database also rolled back (no new columns). The unfinished migration row was removed.

| Step | Risk | What | Rollback |
| --- | --- | --- | --- |
| 0 | Low | Copy the database (`CREATE DATABASE … TEMPLATE` or `pg_dump`). | Drop the copy. |
| 1 | Low | Add tenant columns on `Restaurant` (slug, status, contacts) nullable, backfill tenant #1 to slug `main` and status `ACTIVE`, then set `NOT NULL`. | Drop the new columns and the `TenantStatus` type. |
| 2 | Medium | Add nullable `restaurantId` to every child table. | Drop the new columns. No data movement yet. |
| 3 | Medium | Backfill from the parent row. Orphans (audit rows with no branch, invoices with no order, push rows with no user) go to `11111111-1111-4111-8111-111111111111`. | Columns are still nullable; set them back to null. Original parent links are unchanged. |
| 4 | Low | Abort the migration if any tenant column is still null. | Fix the backfill and rerun. The transaction rolls the failed attempt back. |
| 5 | Medium | `SET NOT NULL`, add foreign keys (`ON DELETE RESTRICT`) and `restaurantId` indexes. | Drop FKs, indexes, and NOT NULL. |
| 6 | High | Replace global uniques with composite or partial uniques. | Recreate the old unique indexes only after confirming no duplicate values exist inside a tenant. Across tenants, duplicates are legal and would block a rollback until they are removed. |
| 7 | Medium | Create `TenantCounter` and `RestaurantNote`. Seed counters from the existing POS and tax counter rows. | Drop the new tables. Old counter tables are still written. |
| 8 | High | RLS: non-superuser role `restaurant_app` (`NOBYPASSRLS`), `ENABLE` and `FORCE` row security, policy on `current_setting('app.tenant_id', true)`, bypass only when `app.tenant_bypass = on`. | `DROP POLICY`, `DISABLE ROW LEVEL SECURITY`, `DROP ROLE`. |
| 9 | Medium | Deploy the application that injects `restaurantId` and refuses queries without a tenant context. | Deploy the previous build. Schema from steps 1–7 is backward compatible with the old code only if the old Prisma client is not used against the new required columns. Roll the app and the schema back together. |

The database owner created by the Postgres image is a superuser. Superusers bypass row-level security even when it is forced. RLS protects queries that run as `restaurant_app`. The Prisma query extension cannot pin `set_config(..., true)` to the same pooled connection as the generated statement. Measured behavior is recorded in `docs/MULTI_TENANCY.md` after Task 1. Until a driver can set the session variable on checkout, tenant safety in this process is the Prisma extension plus `tenancy:check`. RLS is still installed and tested with `SET LOCAL ROLE restaurant_app` inside one transaction.

`RESTAURANT_ID` remains only as the id used when `SINGLE_TENANT_MODE=true`. In production the flag defaults off: an unset flag does not fall back. Outside production an unset flag still falls back so existing local scripts keep working. `SINGLE_TENANT_MODE=false` disables the fallback everywhere.

## 3. Later tasks (not started in the schema migration)

Task 2 resolves the tenant from the host, then `TenantDomain`, and never from a client-supplied id in production. Task 3 adds plans, subscriptions, and manual invoices as platform tables (they will be allowlisted or explicitly unscoped). Task 4 adds `PlatformUser` and `/platform/*`. Task 5 enforces lifecycle status. Task 6 provisions a tenant in one transaction. Tasks 7–8 are metrics and the `platform/` Next.js app on port 3100. Task 9 is the blocking isolation suite. Task 10 is operations documentation.

No blocker forces a different approach. `Restaurant` can be the tenant.
