import type { BranchScope } from "./branch-scope";

/** Whether a scoped user may read or mutate this coupon row. */
export function couponInBranchScope(scope: BranchScope, coupon: { branchId: string | null }): boolean {
  if (scope.allBranches) return true;
  if (!coupon.branchId) return true;
  return coupon.branchId === scope.branchId;
}
