# Analytics

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/analytics` | Legacy summary (period presets). Uses shared metrics + store timezone. |
| GET | `/admin/analytics/overview` | Full payload: KPIs, series, heatmap, channels, items, customers, operations, etc. |
| GET | `/admin/analytics/export.csv` | UTF-8 CSV with BOM (same query params as overview). Optional `section=kpis\|series\|items\|categories\|customers\|full`. |
| POST | `/admin/analytics/email/test` | ADMIN: trigger scheduled summary email job once. |

Query params: `preset`, `from`, `to` (custom), `compare=previous|lastYear|none`, `granularity`, `page`, `pageSize`, `sort`, `order`, `category`, `q`.

## Timezone

All presets use `resolvePresetRange` (`backend/src/lib/analytics/range.ts`) with the store (or branch) timezone. Dashboard daily KPIs use the same booked/collected definitions via `aggregatePeriodOrderMetrics`.

## Metric definitions

See `backend/src/lib/metrics/definitions.ts`.

| Metric | Definition |
|--------|------------|
| Booked | Sum of totals for non-cancelled orders placed in range (`createdAt`) |
| Collected | Sum of totals for completed orders (`DELIVERED`, `COLLECTED`, `SERVED`) placed in range |
| Avg order value | Collected ÷ completed count |

## Settings (ADMIN)

- `weekStartDay` (default Monday = 1)
- `analyticsInsightMinDays` / `analyticsInsightMinOrders` — insight cards gate
- `analyticsEmail*` — scheduled summary email

## Roles

- **ADMIN / MANAGER**: full financial + control + profit sections on overview.
- **CHEF / CASHIER**: no `/admin/analytics` route.

## Manual QA checklist

### Desktop (1440px, light + dark)

- [ ] Presets update URL and KPIs refresh
- [ ] Compare previous / last year / none
- [ ] Collected ≠ Booked on seeded data when completions lag
- [ ] Export CSV opens in Excel with correct dates
- [ ] Print hides chrome
- [ ] Match dashboard Collected/Booked for “today” preset vs dashboard KPIs

### Mobile (390px)

- [ ] No horizontal scroll (`scrollWidth <= innerWidth`)
- [ ] Preset chips scroll; Compare reachable
- [ ] KPI grid 2 columns; item cards on small screens

### Roles

- [ ] ADMIN: profit/control visible when data present
- [ ] MANAGER: same branch scope as dashboard

## Screenshots

Save under `docs/screenshots/analytics/` (run `E2E_RUN=1 npm run test:e2e -- e2e/analytics.spec.ts` with Playwright browsers installed).

## Demo data (charts)

From `backend/`:

```bash
npm run seed:analytics
```

Creates ~90 orders over the last 35 days (`ANL-*` order numbers): mixed channels, payments, fulfillment, completions, cancellations, coupons, and ratings. Safe to re-run (replaces previous `ANL-*` orders only).

## Tests

- Backend: `npm run test:vitest -- test/analytics-*.test.ts`
- Frontend: `npm test -- src/lib/analytics/helpers.test.ts`

## Known gaps

- `attachRate` (basket pairs) not computed yet
- Guest customers counted by phone/email when no `customerId`
- Cancellation reasons from `OrderEvent.reason` when present
- Gross profit coverage depends on recipe + ingredient costs on the branch
