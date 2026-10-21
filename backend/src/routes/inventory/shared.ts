import { Role } from "@prisma/client";
import { resolveBranchScope } from "../../lib/branch-scope";
import { inventoryDisplayStatus } from "../../lib/inventory/stock-status";
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

/** Ensures a branch-scoped inventory row belongs to the header branch (managers cannot cross branches). */
export async function assertInventoryBranch(
  req: import("express").Request,
  resourceBranchId: string,
  message = "This record is outside your branch."
) {
  const branchId = await resolveBranchId(req);
  if (resourceBranchId !== branchId) {
    throw Object.assign(new Error(message), { status: 403 });
  }
}

export function itemStatus(qty: number, reorder: number, expiringSoon: boolean) {
  return inventoryDisplayStatus(qty, reorder, expiringSoon);
}
