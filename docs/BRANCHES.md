# Branches

Multi-branch restaurants use **branches** (not “outlets”) for kitchen queues, POS, stock, and scoped admin data. Enforcement is server-side; the admin UI reflects API rules.

## Data model

| Field | Notes |
| --- | --- |
| `name`, `code` | `code`: 2–6 chars `A–Z`/`0–9`, unique per restaurant. Used in POS order numbers (`ORD-{CODE}-…`) and tax invoice numbers. Immutable after the branch has any order. |
| `address` | Legacy single line; kept in sync with structured fields. |
| `addressLine`, `area`, `city` | Structured address. |
| `latitude`, `longitude` | Optional map pin. |
| `email`, `phone` | Contact. |
| `managerUserId` | Optional; must be a `BranchMember` of that branch. |
| `acceptsOnlineOrders` | Default `true`. When `false`, storefront checkout is rejected server-side. |
| `isActive`, `deactivatedAt` | Inactive branches keep history; no new orders/bookings (see dine-in checks). |
| `isDefault` | Exactly one default among active branches (enforced on make-default / create). |

Opening hours for “open now” on branch cards use **store** hours (`StoreSettings` schedule). Per-branch hours are not in the schema yet.

## API (`/admin/branches`)

| Method | Path | Roles | Description |
| --- | --- | --- | --- |
| GET | `/admin/branches?range=today\|7d\|30d` | ADMIN (all), MANAGER (own) | Branch cards, live KPIs, optional `performance` block for ADMIN. |
| POST | `/admin/branches` | ADMIN | Create branch. |
| PATCH | `/admin/branches/:id` | ADMIN | Update; deactivation via `isActive: false` runs blocker checks. |
| POST | `/admin/branches/:id/make-default` | ADMIN | Single default transaction. |
| PATCH | `/admin/branches/:id/online-ordering` | ADMIN | Toggle with `reason` when disabling; audit-logged. |
| GET | `/admin/branches/:id/deactivation-check` | ADMIN | Blockers + staff count. |
| POST | `/admin/branches/:id/deactivate` | ADMIN | Re-check blockers; `staffAction`: `reassign` + `targetBranchId` or `revoke`. |
| POST | `/admin/branches/:id/reactivate` | ADMIN | Set active again. |

Public pickup list: `GET /branches/public` — active branches only, includes `acceptsOnlineOrders`.

## Deactivation blockers

- Default branch or last active branch
- Open pipeline orders, open cash shifts, upcoming pending/confirmed reservations
- Occupied/reserved tables, active waitlist
- Pending rider cash entries
- Orders with `needsReview` (offline POS), when enabled

## Staff on deactivation

Non-admin staff access a branch via `BranchMember` and `userCanAccessBranch` (branch must be `isActive`). Deactivating without reassignment removes members on the explicit `revoke` path; otherwise reassign to another active branch.

**Seed note:** `prisma/seed.ts` assigns every CHEF/RIDER/CASHIER/MANAGER user to the main branch — that is why a single branch can show ~29 staff.

## Branch code usage

- `backend/src/lib/pos-order-number.ts` — `ORD-{CODE}-…`
- `backend/src/lib/tax/invoice-number.ts` — fiscal invoice prefix
- `backend/src/routes/shifts.ts` — CSV export column
- Admin UI shifts table

## Performance / timings

`GET /admin/branches` logs `meta.ms` on the response (target: no per-branch N+1 for counts; today metrics use bounded parallel aggregates per branch).

## Per-branch vs global audit

| Module | Scope | Notes / files |
| --- | --- | --- |
| Menu items (catalog) | **GLOBAL** (intended) | `MenuItem` is restaurant-wide; base price in `schema.prisma`. |
| Menu availability / sold-out | **PER_BRANCH** | `MenuItemBranchAvailability`, `admin-menu/mutations.ts`, `routes/kitchen.ts`. |
| Branch menu prices | **GLOBAL (gap)** | No per-branch price column; copy-from in Task 3 may need schema later (~2–3d). |
| Categories | **GLOBAL** (intended) | `routes/categories.ts` — no `branchId`. |
| Deals / offers | **GLOBAL** (intended) | `Deal` model; branch sold-out via `DealBranchAvailability`. |
| Coupons / vouchers | **PER_BRANCH** + global rows | `Coupon.branchId` nullable; scoped in `routes/coupons.ts` (PATCH fixed Task 2). |
| Stock quantities & valuation | **PER_BRANCH** | `BranchStock`, `routes/inventory/*` via `resolveBranchId`. |
| Recipes | **GLOBAL** (intended) | `MenuRecipe` on menu item; consumption uses branch stock. |
| Purchases / receive | **PER_BRANCH** | `InventoryPurchase.branchId`; void was scoped; payment PATCH fixed Task 2. |
| Stock transfers | **PER_BRANCH** | List/create scoped; ship/receive by branch fixed Task 2. |
| Stock counts | **PER_BRANCH** | `StockCount.branchId`; GET/submit/approve/lines fixed Task 2. |
| Orders & pipeline | **PER_BRANCH** | `Order.branchId`, `resolveBranchScope` on admin/kitchen/POS paths. |
| Order numbering | **PER_BRANCH** | `pos-order-number.ts`, `BranchPosOrderDayCounter`. |
| Tax invoices | **PER_BRANCH** | `BranchTaxInvoiceCounter`, `tax/invoice-number.ts`. |
| Cash shifts | **PER_BRANCH** | `CashShift.branchId`, `routes/shifts.ts`. |
| Rider cash | **PER_BRANCH** | `RiderCashEntry.branchId`, `routes/rider-cash.ts`. |
| Riders (fleet) | **PER_BRANCH** | `riderWhereForScope` in `branch-scope.ts`, `admin.ts` riders. |
| Print stations / KOT | **PER_BRANCH** | `PrintStation.branchId`, `print-stations.ts`, `kot.ts`. |
| Tables / floor | **PER_BRANCH** | `DiningFloor`, `DiningTable`, `dine-in.ts` (`requireBranchId`). |
| Bookings / waitlist | **PER_BRANCH** | `Reservation`, `WaitlistEntry`; public endpoints take `branchId`. |
| Delivery areas | **GLOBAL (gap)** | `DeliveryArea` has no `branchId` (`routes/delivery-areas.ts`) — ~3–5d to branch-scope. |
| Opening hours | **GLOBAL** (intended) | `StoreSettings` schedule; branch `timezone` for day boundaries only. |
| Tax profile | **GLOBAL** (intended) | `StoreSettings.taxPercent`, `taxEnabled`. |
| Store branding / settings | **GLOBAL** (intended) | `routes/settings.ts`. |
| Audit log | **PER_BRANCH** (filter) | `audit-log-query.ts` + `X-Branch-Id`. |
| Reports / analytics | **PER_BRANCH** | `reports.ts`, `analytics-overview.ts`, `dish-costing-report.ts`. |
| Dashboard summary | **PER_BRANCH** | `admin.ts` dashboard, `dashboard/summary.ts`. |
| Notifications | **GLOBAL** (intended) | Staff/customer notifications not branch-partitioned. |
| Suppliers / ingredient catalog | **GLOBAL** (intended) | Shared vendor list; stock is per branch. |
| `MenuItem.printStationId` | **LEAK (data)** | Station is per-branch but item link is global — enforce on save (~0.5d) or document; not auto-fixed in Task 2. |

**Automated isolation:** `branch-manager-scope.test.ts`, `branch-manager-scope-extended.test.ts`, `idor-scope.test.ts`.

## Copy-from

`POST /admin/branches` (body `copyFrom`) or `POST /admin/branches/:id/copy-from` — options: `menuAvailability`, `printStations`, `tables`. Delivery areas and opening hours are store-level (skipped with notes). Idempotent upserts on unique keys.

## Setup checklist

Each branch card includes `setupChecklist` (staff, opening stock, tables, printers, test order). Dismissal is client-side (`localStorage`).

## Branch limit

No plan / max-branch field exists in the codebase — not enforced.

## Manual QA

**ADMIN desktop (light/dark)**  
- [ ] KPI row: branches, open now, sales today (all branches), in progress  
- [ ] Range selector updates performance table  
- [ ] Add branch with structured address, code, copy-from  
- [ ] Deactivate blocked for default / last active; blocker list + staff reassign  
- [ ] Online ordering off + storefront checkout rejected  
- [ ] Performance CSV export  
- [ ] Inactive section collapsed  

**MANAGER mobile**  
- [ ] Only own branch card; no add/deactivate/make-default  
- [ ] Open kitchen/POS switches header branch  
- [ ] No horizontal scroll at 390px  

**Roles**  
- [ ] Header switcher: full name tooltip; single-branch label when alone  

## Client bundle

`/admin/branches` First Load JS ~12.3 kB (was ~8.4 kB); performance table lazy-loaded.
