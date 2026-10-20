# Live board (`/admin/tracking`)

Real-time operations board for in-flight orders. Shares the **`OrderBoard`** UI with **Orders → Grid** (`/admin/orders?view=board`), backed by `GET /admin/tracking/board` (not the legacy `GET /orders/board` kanban).

## Column mapping

One config on server (`backend/src/lib/admin-orders/board-columns.ts`) and client (`frontend/src/lib/admin-orders/board-columns.ts`):

| Column ID | Order statuses | Notes |
| --- | --- | --- |
| `PENDING_CONFIRMATION` | `PENDING_CONFIRMATION` | Hidden in UI when empty |
| `CONFIRMED` | `CONFIRMED` | |
| `PREPARING` | `PREPARING` | |
| `READY` | `READY` | |
| `OUT_FOR_DELIVERY` | `OUT_FOR_DELIVERY` | **Delivery only** — dine-in / takeaway never appear here |
| `COMPLETED` | `DELIVERED`, `COLLECTED`, `SERVED` | Card shows outcome badge (Delivered / Picked up / Served) |
| *(side)* `CANCELLED` | `CANCELLED` | **Cancelled today** only (store calendar day), collapsible |

Status changes use **`order-machine`** via `POST /admin/orders/:id/transition`. UI `nextAction` comes from `nextActionsForRole` (verb labels: Start preparing, Mark ready, Out for delivery, Picked up, Mark served, Complete).

## Thresholds (`StoreSettings`)

| Key | Default | Effect |
| --- | --- | --- |
| `lateConfirmMinutes` | 15 | Late on `PENDING_CONFIRMATION` / `CONFIRMED` |
| `latePrepMinutes` | 30 | Late on `PREPARING` / `READY` |
| `lateDeliveryMinutes` | 45 | Late on `OUT_FOR_DELIVERY` |
| `ordersStaleHours` | 2 | Stale on any non-terminal pipeline status |
| `trackingCompletedWindowHours` | 0 | `0` = completed orders **today** (store TZ); `>0` = rolling hours for Completed column |
| `duplicateOrderWindowMinutes` | 10 | List/detail duplicate hint (board skips N+1 dup scan) |

Ages use **server** `statusChangedAt` + `ageSeconds` at `serverTime` (not browser clock). Display clock: **12-hour** `formatStoreTime12h` (e.g. `9:04 PM`).

## API

### `GET /admin/tracking/board`

Query: `type[]`, `riderId`, `lateOnly`, `branchId` (ADMIN all-branches scope).

Response:

- `columns[]`: `id`, `label`, `count`, `value` (pipeline ₹ — **excludes Completed**), `cards[]`, `historyLink` on Completed
- `cancelledToday`: `{ count, cards }`
- `summary`: `active`, `late`, `stale`, `unassignedDeliveries`, `pipelineValue`, `pipelineValueDefinition` (from `lib/metrics/tracking-board.ts`)
- `serverTime`, `timezone`, `timingMs`

**Active** matches Dashboard pipeline: count of orders in `PIPELINE_STATUSES` (same set as dashboard stage sums).

**Pipeline value**: sum of `total` for pipeline statuses only (not completed/cancelled).

### `GET /admin/tracking/summary`

Lightweight pipeline metrics for nav badge and Orders header (`active`, `late`, `badge` = late if any else active).

### `GET /admin/tracking/riders`

- Per rider: `activeDeliveries` (short numbers + `outSinceSeconds`), `codCashHeld`, `status`
- `location.locationAvailable`: always `false` today (no rider GPS in DB) — **no map view**

### Actions (reuse orders dispatch)

| Method | Path |
| --- | --- |
| `POST` | `/admin/orders/:id/transition` |
| `POST` | `/admin/orders/:id/assign-rider` |
| `POST` | `/admin/orders/bulk` (`assignRider`, `cancelStale`, …) |

Assign rider: **ADMIN / MANAGER** only (`assignRiderToOrder`). Audit via existing order audit actions.

## Socket.IO

| Event | When |
| --- | --- |
| `order:created` / `order:updated` | Existing ops broadcast |
| `tracking:board-delta` | `{ kind: order_created \| order_transitioned \| rider_assigned, orderId, at }` on `ops` + `branch:{branchId}` |

Client: `useLiveOrders` listens to board delta + order events; polls every **8s** when tab visible and no drawer/sheet open.

## Role visibility

| Role | Board | Phone | Payment | Rider panel COD | Assign rider |
| --- | --- | --- | --- | --- | --- |
| ADMIN | ✓ | ✓ | ✓ | ✓ | ✓ |
| MANAGER | ✓ | ✓ | ✓ | ✓ | ✓ |
| CASHIER | ✓* | masked | ✓ | ✓ | ✗ |
| CHEF | ✓* | masked | hidden | hidden | ✗ |
| WAITER | ✓* | ✓ | ✓ | ✓ | ✗ |
| RIDER | own deliveries | — | — | — | ✗ |

\*Branch-scoped via `X-Branch-Id` / membership. CHEF: kitchen `nextActions` only.

## Frontend

- **Shared:** `frontend/src/components/admin/order-board/` (`OrderBoard`, `OrderBoardCard`, `RiderPanel`)
- **Tracking page:** slim summary bar, filters in URL, mobile filter sheet, Board \| Riders tabs
- **Orders grid:** `fetchTrackingBoard` when `view=board`
- **Legacy removed from tracking:** `KanbanBoard`, `GET /orders/board`

### Layout

- Phone: status tabs + one column; long-press delivery cards → bulk assign
- Tablet: horizontal snap columns
- Desktop (xl+): all columns + rider sidebar

### TV / fullscreen

Use **TV** on the Live board header (or `?tv=1`) — hides admin chrome, enlarges cards, optional browser fullscreen. Session flag: `uff-tracking-tv`.

### Drag and drop

Drag a card onto another column when the transition is allowed; uses `POST /admin/orders/:id/transition`. An **Undo** toast appears for 8 seconds (same as kitchen).

## Indexes

- `Order(branchId, status, createdAt)` — pipeline fetch
- `Order(branchId, customerPhone, createdAt)` — duplicate detection on list (dispatch migration)

Target board API **&lt;300ms** on seeded data — check `timingMs` in board JSON under load.

## Tests

| Layer | Path |
| --- | --- |
| Backend unit | `backend/test/admin-tracking.unit.test.ts`, `admin-orders.unit.test.ts` |
| Backend integration | `backend/test/admin-orders.integration.test.ts` (board + riders; needs `DATABASE_URL`) |
| Frontend unit | `frontend/src/lib/admin-orders/*.test.ts`, `mobile-board-tabs.test.ts` |
| E2E | `frontend/e2e/tracking-board.spec.ts` (`E2E_RUN=1`) — admin/cashier/chef, 390/768/1440, grid Active parity |

```bash
# Backend
cd backend && npx vitest run test/admin-tracking.unit.test.ts test/admin-orders.unit.test.ts

# Frontend
cd frontend && npx vitest run src/lib/admin-orders/

# E2E (API + DB + playwright browsers)
E2E_RUN=1 npm run test:e2e -- e2e/tracking-board.spec.ts
```

## Screenshots

Capture into `docs/screenshots/tracking/`:

| File | Viewport | Theme / mode |
| --- | --- | --- |
| `tracking-390-light.png` | 390×844 | Light, board tab |
| `tracking-768-light.png` | 768 | Light, tablet snap |
| `tracking-1440-light.png` | 1440 | Light, desktop + rider panel |
| `tracking-390-dark.png` | 390 | Dark |
| `tracking-1440-dark.png` | 1440 | Dark |
| `tracking-tv-1440.png` | 1440 | TV mode (when implemented) |

E2E writes the light/dark PNGs above when run with `E2E_RUN=1` successfully.

**DB note:** If `trackingCompletedWindowHours` is missing after an early apply of `20261020140000_orders_dispatch_settings`, run migrations through `20261020150000_store_settings_tracking_completed_window`.

## Manual QA checklist

### All roles
- [ ] Login as ADMIN, MANAGER, CASHIER, CHEF — board loads; CHEF/CASHIER see expected field hiding
- [ ] Connection banner when socket offline; recovers on reconnect
- [ ] Updated time + refresh icon (not large orange primary)
- [ ] Completed column: only today (or configured window); pipeline value excludes completed
- [ ] Dine-in: no Out for delivery; table bold / No table
- [ ] Takeaway: “Pickup” (not store address)
- [ ] Delivery: assign rider; cannot transition to Out for delivery without rider
- [ ] Late / stale: text labels + border; oldest first in column
- [ ] `#1011` large, full number copy; single age with tooltip time
- [ ] Payment badge (paid / partial / COD due)
- [ ] Rider panel: deliveries, COD, assign delivery flow
- [ ] Bulk: long-press deliveries → assign rider → partial failure message if any
- [ ] Orders grid board counts match tracking for same branch/filters
- [ ] Dashboard Active ≈ tracking Active (same branch)

### Mobile (390)
- [ ] No horizontal page scroll
- [ ] Filter bottom sheet; Board \| Riders tabs
- [ ] Drawer full screen; safe area above bottom nav
- [ ] Primary action ≥44px tall

### Desktop
- [ ] All columns visible at 1440 without page horizontal scroll
- [ ] Sticky column headers

### Dark mode
- [ ] Contrast on cards, badges, focus rings

## Investigations (reference)

| Question | Finding |
| --- | --- |
| Duplicate board logic? | Merged: `OrderBoard` replaces `OrdersStatusBoard` + mobile `OrdersBoardTabs` on grid; tracking dropped `KanbanBoard` |
| Mixed order numbers? | Multiple generators historically; display unified via `deriveShortOrderNumber`; POS uses `nextPosOrderNumber` |
| Sidebar red “7” on Live tracking? | No badge wired to tracking in `admin/layout.tsx` — likely old client kanban count or another nav badge |
| Lahore addresses? | Seed `CITY_COORDS` includes Lahore; not production geocoding |
| Rider GPS / map? | **No** rider location storage; **no** map library — Live board only |
| Completed orders without payment? | COD/unpaid common on delivery until delivered; check `paymentMethod` + `payments` in DB for anomalies |
| Metrics shared? | Tracking `active` / pipeline use `PIPELINE_STATUSES` + `tracking-board.ts`; Dashboard **booked** still period `aggregatePeriodOrderMetrics` |

## Open decisions

- Cashier assign rider (server: ADMIN/MANAGER only; cashiers see board but cannot assign)
- Map when rider app ships GPS + chosen map stack

## Benchmark

```bash
cd backend && node scripts/benchmark-tracking-board.mjs
```

Logs `timingMs` (target &lt;300ms on seeded data).
