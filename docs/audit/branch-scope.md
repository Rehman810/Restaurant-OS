# Branch scope audit

`resolveBranchScope` / `branchScopeError` usage in route modules. **SCOPED** = branch filter applied; **GLOBAL** = admin all-branches by design; **LEAK** = missing scope.

**Fix (2026-10):** `canAccessOrder` no longer grants global access to all chefs/cashiers; staff need `branchMember` on the order’s `branchId`. Order mutations use `isOrderOutsideUserBranch`. Covered by `branch-manager-scope.test.ts` and `idor-scope.test.ts`.

| Area | File | SCOPED / GLOBAL |
| --- | --- | --- |
| POS | `routes/pos.ts` | SCOPED |
| Orders (admin paths) | `routes/orders.ts` | SCOPED |
| Shifts | `routes/shifts.ts` | SCOPED |
| Audit logs | `routes/audit-logs.ts` | SCOPED |
| Inventory | `routes/inventory/*` | SCOPED |
| Staff | `routes/staff.ts` | SCOPED |
| Reports | `routes/reports.ts` | SCOPED |
| KOT | `routes/kot.ts` | SCOPED |
| Print stations | `routes/print-stations.ts` | SCOPED |
| Rider cash | `routes/rider-cash.ts` | SCOPED |
| Coupons admin | `routes/coupons.ts` | SCOPED (branch coupon or global code) |
| Admin dashboard | `routes/admin.ts` | SCOPED / GLOBAL for ADMIN |
| Dine-in admin | `routes/dine-in.ts` | SCOPED |

**MANAGER isolation tests:** `branch-manager-scope.test.ts`, `branch-manager-scope-extended.test.ts` (coupons, inventory counts/transfers, header `X-Branch-Id`), `idor-scope.test.ts`.

**Task 2 fixes:** coupon PATCH scope (`coupon-branch-scope.ts`); inventory purchase payment, stock count by id, transfer ship/receive (`assertInventoryBranch` in `inventory/shared.ts`).

Full module matrix: `docs/BRANCHES.md` § Per-branch vs global audit.
