import { Role } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "./prisma";
import type { AuthUser } from "../middleware/auth";

import { STAFF_DIRECTORY_ROLES } from "./roles";

const STAFF_ROLES = STAFF_DIRECTORY_ROLES;

export type BranchScope = {
  branchId: string | null;
  allBranches: boolean;
  where: { branchId?: string };
};

export async function ensureDefaultBranch(): Promise<string> {
  const existing =
    (await prisma.branch.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    })) ||
    (await prisma.branch.findFirst({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true },
    }));
  if (existing) return existing.id;

  const settings = await prisma.storeSettings.findFirst({
    select: { storeName: true, address: true, phone: true },
  });
  const created = await prisma.branch.create({
    data: {
      name: settings?.storeName?.trim() ? `${settings.storeName.trim()} — Main` : "Main branch",
      code: "main",
      address: settings?.address || "",
      phone: settings?.phone || "",
      isDefault: true,
      isActive: true,
      sortOrder: 0,
    },
  });
  return created.id;
}

export async function getDefaultBranchId(): Promise<string> {
  return ensureDefaultBranch();
}

export async function listBranchesForUser(user: AuthUser) {
  if (user.role === Role.ADMIN) {
    return prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  return prisma.branch.findMany({
    where: {
      isActive: true,
      members: { some: { userId: user.id } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function userCanAccessBranch(user: AuthUser, branchId: string): Promise<boolean> {
  if (user.role === Role.ADMIN) return true;
  const member = await prisma.branchMember.findFirst({
    where: { userId: user.id, branchId, branch: { isActive: true } },
    select: { id: true },
  });
  return Boolean(member);
}

/** True when a non-admin staff user must be blocked from this order's branch. */
export async function isOrderOutsideUserBranch(
  user: AuthUser,
  order: { branchId: string | null }
): Promise<boolean> {
  if (user.role === Role.ADMIN) return false;
  if (!order.branchId) return false;
  return !(await userCanAccessBranch(user, order.branchId));
}

/** Resolve branch filter from `X-Branch-Id` header (`all` = no filter for admin). */
export async function resolveBranchScope(req: Request): Promise<BranchScope> {
  const user = req.user!;
  const raw = String(req.headers["x-branch-id"] || "").trim();

  if (user.role === Role.ADMIN && (!raw || raw === "all")) {
    return { branchId: null, allBranches: true, where: {} };
  }

  const branchId = raw || (await getDefaultBranchId());
  const ok = await userCanAccessBranch(user, branchId);
  if (!ok) {
    throw Object.assign(new Error("You do not have access to this branch."), { status: 403 });
  }

  return { branchId, allBranches: false, where: { branchId } };
}

export function mergeOrderWhere<T extends object>(base: T, scope: BranchScope): T & { branchId?: string } {
  if (scope.allBranches) return base;
  return { ...base, branchId: scope.branchId! };
}

export async function syncUserBranches(userId: string, branchIds: string[]) {
  const unique = [...new Set(branchIds.filter(Boolean))];
  if (unique.length) {
    const count = await prisma.branch.count({ where: { id: { in: unique }, isActive: true } });
    if (count !== unique.length) {
      throw Object.assign(new Error("One or more branches are invalid."), { status: 400 });
    }
  }
  await prisma.branchMember.deleteMany({ where: { userId } });
  if (unique.length) {
    await prisma.branchMember.createMany({
      data: unique.map((branchId) => ({ branchId, userId })),
    });
  }
}

export function orderBranchWhere(scope: BranchScope): { branchId?: string } {
  return scope.allBranches ? {} : { branchId: scope.branchId! };
}

export function staffWhereForScope(scope: BranchScope): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { role: { in: STAFF_ROLES } };
  if (scope.allBranches) return base;
  return {
    ...base,
    OR: [{ role: Role.ADMIN }, { branchMembers: { some: { branchId: scope.branchId! } } }],
  };
}

export function riderWhereForScope(scope: BranchScope): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { role: Role.RIDER };
  if (scope.allBranches) return base;
  return {
    ...base,
    branchMembers: { some: { branchId: scope.branchId! } },
  };
}

export function branchScopeError(res: import("express").Response, err: unknown) {
  const status = typeof err === "object" && err && "status" in err ? Number((err as { status: number }).status) : 500;
  const message = err instanceof Error ? err.message : "Branch error";
  return res.status(status).json({ error: message });
}
