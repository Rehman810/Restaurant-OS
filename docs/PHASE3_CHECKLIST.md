# Phase 3 — Deliverable checklist

Use this after migrations and `npm run seed:demo`. Payment gateways are **out of scope** (cash/COD + counter card flag only).

## Environment

- [ ] `npm run prisma:migrate` applied (includes `20241017200000` … `20241017230000`)
- [ ] `JWT_SECRET` set (32+ chars) in `backend/.env`
- [ ] API on `:4000`, web on `:3000`, `CLIENT_URL` includes web origin
- [ ] Optional push: `VAPID_*` on API + **Order status push** enabled in Settings

## Task 1–2 — Offline POS

| Check | How |
| --- | --- |
| POS service worker registers | DevTools → Application → SW under `/admin/pos/` |
| Offline sale queues in IDB | Go offline on POS, complete cash sale, see offline bar |
| Sync creates server order | Online → Sync; order in kitchen / admin orders |
| Clock skew / review flag | Device time off → `needsReview` on sync-conflicts page |
| Cash movement queue | Paid in/out offline syncs via `/pos/sync/cash-movement` |
| Logout guard | Pending queue warns before leaving POS |

**Automated:** `E2E_RUN=1 npm run test:e2e -- e2e/phase3-offline-pos.spec.ts` (cashier `cashier@demo.restaurant` / `demo1234`, open shift first).

## Task 3 — Reports & inventory

| Check | How |
| --- | --- |
| Dish costing | `/admin/reports/dish-costing` |
| Menu engineering | `/admin/reports/menu-engineering` (+ CSV `?format=csv`) |
| Daily summary | `/admin/daily-summary` |
| Timezone “today” | Dashboard stats match branch TZ |
| Purchase void API | `POST /admin/inventory/purchases/:id/void` |
| Low-stock badge | Inventory nav when alerts exist |

## Task 4 — Tax invoicing

| Check | How |
| --- | --- |
| Tax mode in Settings | Enable tax invoicing, NTN/STRN, rates |
| POS order snapshots | Line tax fields on paid POS order |
| TAX-* invoice number | After paid POS or delivered online order |
| Credit note on void | Void paid POS order → credit note register |
| Tax reports | `/admin/reports/tax` + CSV exports |
| PDF invoice | Download on delivered order |

See [TAX_INVOICING_NOTES.md](./TAX_INVOICING_NOTES.md) for legal/compliance gaps.

## Task 5 — Storefront UX

| Check | How |
| --- | --- |
| PWA manifest | `/manifest.webmanifest` shows store name |
| Install banner | Chromium `beforeinstallprompt` (or Add to Home Screen) |
| Track page | `/track` with order # + phone |
| EN / Urdu | Navbar toggle; track title translates |
| Feedback | Complete order → 1–5 stars on order detail |
| Push opt-in | Enable push in Settings + VAPID → button on active order |

**Automated (no DB):** `npm run test:e2e -- e2e/phase3-storefront.spec.ts`

## Task 6 — Regression matrix

| Suite | Command | Needs `E2E_RUN=1` |
| --- | --- | --- |
| Storefront smoke | `e2e/smoke.spec.ts` | Yes |
| Phase 2 | `e2e/phase2.spec.ts` | Yes |
| Phase 3 storefront | `e2e/phase3-storefront.spec.ts` | No (track + manifest only) |
| Phase 3 offline POS | `e2e/phase3-offline-pos.spec.ts` | Yes |
| Phase 3 admin reports | `e2e/phase3-admin.spec.ts` | Yes |

Full Phase 3 e2e (with DB):

```bash
cd frontend
E2E_RUN=1 E2E_BASE_URL=http://localhost:3000 npm run test:e2e -- e2e/phase2.spec.ts e2e/phase3-*.spec.ts e2e/smoke.spec.ts
```

Backend unit tests:

```bash
npm test
```

## Demo accounts (seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@admin.com` | `admin` (or `SEED_ADMIN_PASSWORD`) |
| Cashier | `cashier@demo.restaurant` | `demo1234` |
| Chef | `chef@demo.restaurant` | `demo1234` |

Promo: **WELCOME10** (Phase 2).

## Sign-off

- [ ] Typecheck: `npm run typecheck` from repo root
- [ ] No secrets committed (`.env` local only)
- [ ] Production: `storefrontPushEnabled` / tax / offline flags reviewed per tenant
