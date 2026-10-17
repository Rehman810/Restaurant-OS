# Admin dashboard API

## `GET /admin/dashboard/summary?branchId=`

Single payload for `/admin`. Requires auth; roles: `ADMIN`, `MANAGER`, `CASHIER`, `CHEF` (financial sections omitted for cashier/chef).

Response headers: `Cache-Control: no-store`.

### Definitions (store timezone)

| Field | Meaning |
| --- | --- |
| **Booked** | Sum of `total` for orders **created today** (branch scope) with status ≠ `CANCELLED`. |
| **Collected** | Sum of `total` for orders **created today** in terminal success states: `DELIVERED`, `COLLECTED`, `SERVED`. |
| **Completed today** | Count of those terminal orders created today. |
| **Pipeline** | In-flight counts for `PENDING_CONFIRMATION` … `OUT_FOR_DELIVERY` (delivery only for out-for-delivery). |
| **Late orders** | Active orders whose time in current status (`updatedAt`) exceeds thresholds from settings. |

### Settings defaults (`StoreSettings`)

| Key | Default |
| --- | --- |
| `lateConfirmMinutes` | 15 |
| `latePrepMinutes` | 30 |
| `lateDeliveryMinutes` | 45 |
| `shiftOpenWarningHours` | 12 |
| `riderCashWarningHours` | uses `riderCashStaleHours` (24) |
| `lowRatingThreshold` | 2 (ratings ≤ threshold count as “needs attention”) |
| `twoFaReminderDays` | 7 |

### Top-level shape

- `generatedAt`, `timezone`, `storeState` (online ordering open/closed, `forceClosed`, `nextOpenLabel`)
- `kpis.*` — each KPI includes `value`, `previousYesterday`, `previousSameWeekday`, delta % or `new`/`flat`
- `sourceSplit`, `paymentSplit` (admin/manager only)
- `pipeline`, `lateOrders`, `hourlySales`, `last7Days`, `topSellers`, `shifts`, `riderCash`, `syncConflicts`, `lowStock`, `dineIn`, `controls`, `feedback`, `incomingOrders`, `thresholds`

Legacy `GET /admin/stats` remains for compatibility; new UI should use `/admin/dashboard/summary`.

## Frontend

- Page: `/admin` (`AdminDashboardView`, `data-testid="admin-dashboard"`).
- Data: `useDashboardSummary()` (branch-aware via `BranchContext`, socket debounce 2s, poll 30s when tab visible).
- Sound: `localStorage` key `ros-dashboard-order-sound` (default off); uses kitchen chime when enabled.

## Tests

- Backend unit: `backend/test/dashboard-*.test.ts`
- Backend integration (needs Postgres): `backend/test/dashboard-summary.integration.test.ts`
- Frontend unit: `frontend/src/lib/dashboard/helpers.test.ts`
- E2E: `frontend/e2e/dashboard.spec.ts` (`E2E_RUN=1`, screenshots under `docs/screenshots/dashboard/`)

## Manual QA checklist

- [ ] Admin + Manager: booked/collected, splits, control & cash accordion
- [ ] Cashier + Chef: no financial KPIs; pipeline + incoming orders work
- [ ] Store TZ greeting at morning / afternoon / evening boundaries
- [ ] Online ordering open/close; POS still works when closed
- [ ] Mobile 390px: no horizontal scroll; needs-attention snap row
- [ ] Dark mode charts and KPI contrast
- [ ] Sync conflicts nav item only when offline POS enabled; badge when count > 0
