# Phase 2 — Sale closer

Operational controls added on top of Phase 1 white-label baseline.

## Features

| Area | Admin / staff | Customer |
| --- | --- | --- |
| Audit log | `/admin/audit-log`, CSV export | — |
| Manager approval | Settings → Controls; POS void/discount | — |
| Cash shifts | POS shift panel; `/admin/shifts` | — |
| Rider COD | `/admin/riders/cash` | Rider pending COD banner |
| Print stations & KOT | `/admin/kitchen/stations`; kitchen Print KOT | — |
| Coupons | `/admin/coupons` | Checkout promo code |
| Loyalty (lite) | Settings earn/redeem rates | Points on account; redeem at checkout |
| Reorder | — | Order history & detail → Reorder |

## Demo data

After `npm run seed:demo`, use promo code **WELCOME10** (10% off subtotal ≥ 500, max 300 off).

## Migrations

Run from repo root:

```bash
npm run prisma:migrate
```

Key migrations: audit log, approval controls, cash shifts, rider COD, print stations, coupons/loyalty.

## E2E

With API + web running and DB seeded:

```bash
cd frontend
E2E_RUN=1 npm run test:e2e
```

Specs: `e2e/smoke.spec.ts`, `e2e/phase2.spec.ts` (coupon preview + admin coupons page).

## Manual QA checklist

1. Confirm order → kitchen ticket prints (optional auto-print).
2. Open shift → POS cash sale → close shift with variance note.
3. Deliver COD order → settle rider cash on open shift.
4. Checkout with WELCOME10 and logged-in customer loyalty redeem.
5. Reorder from **My orders**.
