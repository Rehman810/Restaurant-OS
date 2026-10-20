# Admin menu catalog

Restaurant OS catalog lives under **`/admin/catalog/`** — **Dishes**, **Deals**, and **Categories** are separate pages. Legacy **`/admin/menu`** redirects to dishes. The catalog is **restaurant-wide**; **sold-out** and deal availability are **per branch** (branch selector in the admin header / `X-Branch-Id`).

## Dishes

- **List API:** `GET /admin/menu/dishes` — search, category, status chips, sort, pagination.
- **Availability:** `PATCH /admin/menu/dish/:id/availability` — `state`, `until` (`endOfDay` or ISO), `scope` (`currentBranch` | `allBranches`, managers only).
- **Visibility:** `PATCH /admin/menu/dishes/:id/visibility`.
- **Reorder:** `PUT /admin/menu/dishes/reorder` — `{ category, orderedIds }`.
- **Bulk:** `POST /admin/menu/bulk` — availability, visibility, move category, price adjust, archive.
- **URL params (dishes tab):** `q`, `status`, `cat`, `sort`, `order`, `view`, `page`.

Sold-out overrides are stored in `MenuItemBranchAvailability`; legacy global `isAvailable` is migrated on deploy.

## Deals

- **List API:** `GET /admin/menu/deals` — search, deal group, schedule status chips.
- **CRUD:** `POST/PUT /deals` (schedule, channels, visibility, components).
- **Admin:** visibility + availability under `/admin/menu/deals/...`.
- **URL params:** `dq`, `dstatus`, `dgroup`, `dpage`.
- Deal **groups** (`Deal.category`) are separate from dish **categories**.

## Categories

- **List API:** `GET /admin/menu/categories` — search, on-menu / off-hours / hidden chips.
- **Update:** `PUT /admin/menu/categories/:id` or `PUT /categories/:id` — name, banner, visibility, weekly hours (`scheduleDays`, `scheduleStartTime`, `scheduleEndTime`).
- **Reorder:** `PUT /admin/menu/categories/reorder` — `{ orderedIds }`.
- **Delete:** `DELETE /admin/menu/categories/:id` — optional `{ moveToCategoryId }` when dishes exist.
- **Storefront:** `GET /menu` only returns dishes in categories that are visible and **within their weekly schedule** (branch timezone).

## Realtime

`menu:catalog-changed` / `menu:availability-changed` — clients should refetch `/menu` (no server-side menu cache).

## Routes

- `/admin/catalog/dishes`
- `/admin/catalog/deals`
- `/admin/catalog/categories`
- `/admin/menu` — redirects (legacy `?tab=` still honored once)

## Screenshots

Capture UI states under `docs/screenshots/menu/` (dishes grid, deals cards, categories list, mobile filter sheet) when preparing release notes.

## Tests

- **Unit:** `backend/test/admin-menu.unit.test.ts`, `frontend/src/lib/admin-menu/admin-menu.test.ts`
- **E2E:** `frontend/e2e/admin-menu.spec.ts` (requires `E2E_RUN=1` and seeded API)
