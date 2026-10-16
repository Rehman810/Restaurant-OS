import { Role } from "@prisma/client";
import { resolveBranchScope } from "../../lib/branch-scope";
import { ADMIN_LIKE } from "../../lib/roles";

export const READ_ROLES = [...ADMIN_LIKE, Role.CHEF] as Role[];
export const WRITE_ROLES = ADMIN_LIKE;

export async function resolveBranchId(req: import("express").Request) {
  const scope = await resolveBranchScope(req);
  if (scope.allBranches || !scope.branchId) {
    throw Object.assign(new Error("Select a single branch in the header for inventory."), { status: 400 });
  }
  return scope.branchId;
}

export function itemStatus(qty: number, reorder: number, expiringSoon: boolean) {
  if (qty <= 0) return "out";
  if (qty <= reorder) return "low";
  if (expiringSoon) return "expiring";
  return "ok";
}
