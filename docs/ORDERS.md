# Admin orders dispatch

## API (`/admin/orders`)

Requires staff auth. List/detail respect branch scope and role filters (e.g. chefs see kitchen-relevant rows; payment fields hidden for `CHEF` on the client).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/admin/orders` | Paginated dispatch list with filters, summary tiles, `nextActions`, age/late/stale, payment, duplicates |
| `GET` | `/admin/orders/:id` | Detail: items, timeline, payments, customer history, print logs; IP/location **ADMIN only** |
| `POST` | `/admin/orders/:id/transition` | Single allowed status step (+ void fields for cancel) |
| `POST` | `/admin/orders/:id/assign-rider` | Delivery rider assignment |
| `POST` | `/admin/orders/bulk` | Up to 50 orders: transition, assign rider, print KOT, cancel stale |

### Query params (list)

- **Dates:** `from`, `to` (store TZ), or `preset` via UI (`today`, `yesterday`, `week`, `month`, `custom`)
- **Filters:** `status[]`, `type[]`, `source[]`, `payment`, `riderId`, `q` (order #, name, phone)
- **Sort:** `lateFirst` (default on “All”), `newest`, etc.
- **Paging:** `page`, `pageSize` (board view uses up to 100 per page in UI)

### Settings (`StoreSettings`)

| Key | Default | Use |
| --- | --- | --- |
| `ordersStaleHours` | 2 | Stale marker on active orders |
| `duplicateOrderWindowMinutes` | 10 | Duplicate phone warning |
| `lateConfirmMinutes` / `latePrepMinutes` / `lateDeliveryMinutes` | 15 / 30 / 45 | Late flags (aligned with dashboard) |

**Booked** on the orders header uses the same definition as Dashboard/Analytics (`aggregatePeriodOrderMetrics`).

Legacy `GET /orders` remains for older clients.

## Frontend (`/admin/orders`)

- **Table** (desktop): sortable dispatch table, bulk actions, CSV export.
- **Board** (`view=board`): uses **`GET /admin/tracking/board`** and shared **`OrderBoard`** (same as `/admin/tracking`). Desktop columns at `xl+`, tablet snap (`md`–`xl`), phone tabs.
- **Mobile:** filter sheet, card list (table view), long-press to multi-select, primary action button per card.
- **Detail drawer:** timeline, payment, reprint, rider picker; cancel via manager void or cashier approval.
- **Live:** socket `order:created` refreshes list and flashes the new row when `orderId` is present.

Local storage: `uff-orders-view` (`table` | `board`). URL `view=grid` is migrated to `board`.

## Tests

- Backend: `backend/test/admin-orders.unit.test.ts`, `admin-orders.integration.test.ts`
- Frontend: `frontend/src/lib/admin-orders/helpers.test.ts`, `board-columns.test.ts`
- E2E: `frontend/e2e/orders-dispatch.spec.ts`, `frontend/e2e/tracking-board.spec.ts` (`E2E_RUN=1`)
- Live board docs: `docs/TRACKING.md`, screenshots `docs/screenshots/tracking/`

## Manual QA checklist

- [ ] Table + board toggle; board loads up to 100 orders per page
- [ ] Status chips + filter bar sync to URL; mobile filter sheet opens/closes
- [ ] Primary next action matches server `nextActions`; cancel requires reason / manager PIN for cashier
- [ ] Bulk: preparing, KOT print, assign rider, cancel stale (manager)
- [ ] Chef: no payment column; admin: IP/location in drawer only
- [ ] New order socket: banner + row flash (~3s)
- [ ] 390px: no horizontal scroll on orders page; board tabs usable
- [ ] Dark mode contrast on cards and late/stale badges

## Open decisions

- Unify display order numbers across online (`ORD-{n}`) vs POS (`ORD-{branch}-{date}-{seq}`) — UI uses `shortDisplay` / `deriveShortOrderNumber` only.
- Drag-and-drop on board: not implemented; tabs/columns use same data as table.
- Cashier bulk cancel stale: confirm product policy vs manager-only void.
