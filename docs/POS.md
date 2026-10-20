# Admin POS (`/admin/pos`)

Cashier-facing point of sale: menu browse, cart, checkout, cash shift, holds, and offline queue.

## Money rules

- Totals are computed in **minor units** (paisa) on the server via `computePosTotals` / `quoteCharges` + tax enrichment. The client sends `clientTotal`; the server rejects mismatches beyond a small epsilon.
- **Cash drawer** movements use **cash payment amounts** only (not tendered bill size). Split pay records one `OrderPayment` row per tender; `SALE_CASH` movement equals the sum of CASH portions.
- **Change** is validated against tendered for single-cash checkout; stored on the order / payment rows when provided.
- **Discounts** above cashier cap require manager approval (PIN). Offline sync **rejects** any discount or price override.

## Checkout payload (`POST /pos`)

| Field | Notes |
| --- | --- |
| `items`, `deals` | Cart lines; optional `unitPriceOverride` (audited). |
| `fulfillmentType` | `PICKUP`, `DINE_IN`, `DELIVERY`. Dine-in requires active **table session** on the branch. |
| `payments[]` | `{ method, amount, tendered?, changeGiven? }` — split tender. |
| `paymentMethod` | Legacy primary method when `payments` omitted. |
| `cashTendered`, `cashChangeGiven` | Single-cash shortcut. |
| `clientTotal` | Required; must match server total. |
| `idempotencyKey` | UUID → `Order.posClientOrderId`; safe retries. |
| `discountPercent`, reason codes | Server-enforced caps from store settings. |

## Offline queue (`POST /pos/sync`)

- Enabled when `StoreSettings.offlinePosEnabled`.
- **Cash only**; no delivery, card, discounts, or price overrides.
- **Backward compatible**: queued bodies without `payments[]` still sync as one CASH payment for the full total.
- Optional forward fields: `payments[]` (CASH only), `cashTendered`, `cashChangeGiven`, `clientClaimedTotal`.
- Idempotency via `clientOrderId` (same as online `idempotencyKey`).

## Holds

- `POST /pos/holds` — park cart (12h expiry default).
- `GET /pos/holds`, `DELETE /pos/holds/:id`, `POST /pos/holds/:id/resume`.

## Shift (`/pos/shift/*`)

- Open shift required for **cash** sales (`403 SHIFT_REQUIRED`).
- `GET /pos/shift/current` returns `shift`, `report` (`expectedCash`, `byType`), `cashier`, `orderCount` (non-cancelled POS orders since `openedAt`).
- Paid in/out, close with denomination count and variance note when required.

## Roles

| Action | CASHIER | MANAGER+ |
| --- | --- | --- |
| Sell, hold, offline sync | ✓ | ✓ |
| Cash shift open/close | ✓ (own shift) | ✓ |
| Discount above cap / price override | PIN | ✓ |
| Menu 86 (stock) | ✓ (`PATCH /kitchen/menu/:id/stock`) | ✓ |

## UX notes

- Store timezone **12-hour clock** in POS header; fullscreen mode hides admin chrome (`posFullscreen`).
- Mobile: bottom sheet cart; tap **shift line** for summary sheet.
- Keyboard: `/` search, `F2` customer, `F9` charge, `Esc` back.
- Auto-print receipt after successful charge when configured.

## Tests

- Backend: `backend/test/pos-totals-payments.test.ts`, `pos-offline-sync.test.ts`, `pos-offline-sync.integration.test.ts`
- Frontend: `frontend/src/lib/pos/*.test.ts`, `frontend/src/lib/money-units.ts` helpers
- E2E: `frontend/e2e/phase3-offline-pos.spec.ts`, `frontend/e2e/pos.spec.ts` (`E2E_RUN=1`)

## Manual QA checklist

- [ ] Open shift → cash sale → expected cash increases by payment amount only (not tendered)
- [ ] Split cash + card; drawer gets cash portion only
- [ ] Dine-in blocked without table session
- [ ] `clientTotal` mismatch returns 400
- [ ] Double-submit same `idempotencyKey` → single order
- [ ] Offline: queue two orders, sync, kitchen shows no `OFF-` duplicates
- [ ] Hold / resume within expiry
- [ ] 390px: menu scroll, cart sheet, no horizontal overflow
- [ ] Tap shift summary: cashier, float, sales, paid in/out, order count

## Screenshots

Capture with `E2E_RUN=1` via `frontend/e2e/pos-visual.spec.ts` into `docs/screenshots/pos/` (390 / 768 / 1440, light + dark).
