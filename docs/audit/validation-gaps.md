# Input validation gaps

Endpoints below accept writes with **minimal or no schema validation** (manual checks only). Highest-risk items are prioritized for hardening in this sprint.

| Priority | Method | Path | Notes |
| --- | --- | --- | --- |
| P0 | POST | `/orders/` | Checkout body — partial checks in route |
| P0 | POST | `/pos/orders` | POS create — branch/shift guards present |
| P0 | POST | `/pos/sync` | Offline batch — idempotency keys |
| P0 | PATCH | `/orders/:id/status` | Status transitions via state machine |
| P0 | PATCH | `/settings` | Store settings — `settings-validate.ts` |
| P1 | POST | `/admin/coupons/` | Field checks inline |
| P1 | POST | `/admin/staff` | Email/role checks |
| P1 | POST | `/admin/shifts/open` | Shift rules in `cash-shift.ts` |
| P1 | POST | `/admin/rider-cash/settle` | Amount + entry ids |
| P1 | POST | `/admin/inventory/purchases` | Receiving lines |

Regenerate route list: `npm run routes:doc -w restaurant-os-api`.
