# Audit artifacts (stabilization sprint)

| Artifact | Purpose |
| --- | --- |
| [route-table.md](./route-table.md) | Method + path + auth from `createApp()` |
| [validation-gaps.md](./validation-gaps.md) | Write endpoints needing stronger validation |
| [branch-scope.md](./branch-scope.md) | Branch scoping matrix |
| [runtime-verification.md](./runtime-verification.md) | PHASE3 checklist run results |
| [risk-register.csv](./risk-register.csv) | R-001…R-012 status |

Canonical narrative audit: [../RESTAURANT-OS-AUDIT.md](../RESTAURANT-OS-AUDIT.md).

## Maturity (post-sprint)

| Module | Status | Evidence |
| --- | --- | --- |
| API routing | Verified | 349 backend tests (auth matrix + IDOR + mounts) |
| Offline POS | Verified | integration tests on test DB |
| Tax invoicing | Code + unit tests | runtime manual |
| Storefront PWA | Code | E2E job when enabled |
| Reports | Code + timezone tests | manual CSV export |

Scores marked **verified** passed automated tests; **manual** still need `PHASE3_CHECKLIST.md` walkthrough.
