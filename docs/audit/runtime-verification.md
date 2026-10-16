# Runtime verification (PHASE3_CHECKLIST)

Environment: local `db_test` + `npm run dev` (not fully automated in CI for all rows).

| Checklist item | Result | Notes |
| --- | --- | --- |
| Migrations fresh DB | PASS | `prisma migrate deploy` on empty `restaurant_os_test` |
| Backend test suite | PASS | 246 tests (see CI) |
| Production route mounts | PASS | `production-entry-routes.test.ts` |
| Offline POS sync | PASS | `pos-offline-sync.integration.test.ts` |
| Order numbers | PASS | `pos-order-number.test.ts` |
| PIN lockout | PASS | `approval-pin-lockout.test.ts` |
| Inventory concurrency | PASS | `inventory-stock-concurrency.test.ts` |
| Tax PDF / register | NEEDS MANUAL QA | Enable tax in Settings, paid order |
| Storefront PWA install | NEEDS MANUAL QA | Browser install prompt |
| Push notifications | NEEDS MANUAL QA | VAPID keys + browser permission |
| Full PHASE3 UI walk | NEEDS MANUAL QA | See `docs/PHASE3_CHECKLIST.md` |

## Slow endpoints

Not profiled in this sprint — use browser Network tab during manual QA.
