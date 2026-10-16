# Phase 3 — Moat

Operational depth: offline POS, profit/tax reporting, tax-ready invoicing, and storefront PWA UX.

**QA sign-off:** [PHASE3_CHECKLIST.md](./PHASE3_CHECKLIST.md)

## Task 1–2 — Offline-capable POS

- PWA: `frontend/public/pos-sw.js`, `pos-manifest.json`, scoped under `/admin/pos/`
- Backend: `pos-offline-sync`, order numbers, clock skew, cash movement sync, migrations `20241017200000_*`, `20241017210000_*`
- Admin: sync conflicts, offline settings, logout guard

## Task 3 — Food cost & profit reports

- `/admin/reports/dish-costing`, `menu-engineering`, `variance`, `sales-intelligence` (API)
- `/admin/daily-summary`
- Branch TZ fixes for dashboard “today”
- Inventory: purchase void, movement CSV export

## Task 4 — Tax-ready invoicing

See [TAX_INVOICING_NOTES.md](./TAX_INVOICING_NOTES.md).

- Settings tax mode, snapshots on orders, `TAX-*` invoices, credit notes, PDF + tax reports

## Task 5 — Storefront customer UX

| Feature | Location |
|--------|----------|
| Installable PWA | `store-sw.js`, `app/manifest.ts`, `StorePwa`, `InstallAppBanner` |
| Track order | `/track` |
| EN / Urdu | `lib/i18n/storefront.tsx` |
| Feedback | `OrderFeedback`, `POST /orders/:id/feedback` |
| Web push | `web-push.ts`, `OrderPushPrompt` (optional VAPID) |

## Task 6 — Docs, seed, e2e

### Seed

`npm run seed:demo` sets `offlinePosEnabled: true`, sample NTN, 5% tax percent (tax **mode** off until enabled in Settings).

### E2E matrix

| File | Scope |
| --- | --- |
| `e2e/smoke.spec.ts` | Home → menu → checkout |
| `e2e/phase2.spec.ts` | Coupons |
| `e2e/phase3-storefront.spec.ts` | `/track`, manifest (no DB) |
| `e2e/phase3-offline-pos.spec.ts` | Offline POS sync |
| `e2e/phase3-admin.spec.ts` | Reports + sync conflicts |

```bash
cd frontend
npx playwright install chromium

# Quick (no API)
npm run test:e2e -- e2e/phase3-storefront.spec.ts

# Full (API + seeded DB)
E2E_RUN=1 npm run test:e2e -- e2e/smoke.spec.ts e2e/phase2.spec.ts e2e/phase3-*.spec.ts
```

Env overrides: `E2E_BASE_URL`, `E2E_ADMIN_*`, `E2E_CASHIER_*`.

### Related docs

- [PHASE2.md](./PHASE2.md) — coupons, shifts, loyalty
- [TAX_INVOICING_NOTES.md](./TAX_INVOICING_NOTES.md)
- [README.md](../README.md) — onboard & deploy
