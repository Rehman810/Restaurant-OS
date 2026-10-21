import { Role, Prisma } from "@prisma/client";
import type { BranchScope } from "../branch-scope";
import { STAFF_DIRECTORY_ROLES } from "../roles";

export type StaffListQuery = {
  q: string;
  roles: Role[];
  branchId: string | null;
  statuses: ("active" | "inactive")[];
  twoFa: "on" | "off" | null;
  lastActive: "7" | "30" | "90" | "never" | null;
  includeTest: boolean;
  sort: "name" | "role" | "joined" | "lastActive";
  order: "asc" | "desc";
  pageSize: number;
  offset: number;
};

export function parseStaffListQuery(query: Record<string, unknown>): StaffListQuery {
  const q = String(query.q ?? query.search ?? "").trim();
  const roleRaw = query.role ?? query["role[]"];
  const roles: Role[] = [];
  const pushRole = (v: string) => {
    const up = v.trim().toUpperCase();
    if ((STAFF_DIRECTORY_ROLES as string[]).includes(up)) roles.push(up as Role);
  };
  if (Array.isArray(roleRaw)) roleRaw.forEach((r) => pushRole(String(r)));
  else if (typeof roleRaw === "string" && roleRaw) roleRaw.split(",").forEach(pushRole);

  const statusRaw = query.status ?? query["status[]"];
  const statuses: ("active" | "inactive")[] = [];
  const pushStatus = (v: string) => {
    const s = v.trim().toLowerCase();
    if (s === "active" || s === "inactive") statuses.push(s);
  };
  if (Array.isArray(statusRaw)) statusRaw.forEach((s) => pushStatus(String(s)));
  else if (typeof statusRaw === "string" && statusRaw) statusRaw.split(",").forEach(pushStatus);

  const twoFaRaw = String(query.twoFa ?? "").toLowerCase();
  const twoFa = twoFaRaw === "on" || twoFaRaw === "off" ? twoFaRaw : null;

  const lastRaw = String(query.lastActive ?? "").toLowerCase();
  const lastActive =
    lastRaw === "7" || lastRaw === "30" || lastRaw === "90" || lastRaw === "never" ? lastRaw : null;

  const includeTest =
    String(query.includeTest ?? "").toLowerCase() === "true" || String(query.includeTest ?? "") === "1";

  const pageSize = Math.min(
    100,
    Math.max(1, Number(query.pageSize) || Number(query.limit) || 25)
  );
  const page = Math.max(1, Number(query.page) || 1);
  const offset =
    query.offset !== undefined && query.offset !== ""
      ? Math.max(0, Number(query.offset) || 0)
      : (page - 1) * pageSize;

  const sortRaw = String(query.sort ?? "name").toLowerCase();
  const sort: StaffListQuery["sort"] =
    sortRaw === "role" || sortRaw === "joined" || sortRaw === "lastactive" || sortRaw === "last_active"
      ? sortRaw === "joined"
        ? "joined"
        : sortRaw.startsWith("last")
          ? "lastActive"
          : "role"
      : "name";

  const order = String(query.order ?? "asc").toLowerCase() === "desc" ? "desc" : "asc";

  const branchId = String(query.branchId ?? "").trim() || null;

  return {
    q,
    roles,
    branchId,
    statuses,
    twoFa,
    lastActive,
    includeTest,
    sort,
    order,
    pageSize,
    offset,
  };
}

export function staffWhereForViewer(scope: BranchScope, viewerRole: Role): Prisma.UserWhereInput {
  const base: Prisma.UserWhereInput = { role: { in: STAFF_DIRECTORY_ROLES } };
  if (scope.allBranches) return base;
  const branchId = scope.branchId!;
  if (viewerRole === Role.ADMIN) {
    return {
      AND: [
        base,
        {
          OR: [{ role: Role.ADMIN }, { branchMembers: { some: { branchId } } }],
        },
      ],
    };
  }
  return {
    role: { in: STAFF_DIRECTORY_ROLES.filter((r) => r !== Role.ADMIN) },
    branchMembers: { some: { branchId } },
  };
}

export function buildStaffWhere(
  scope: BranchScope,
  viewerRole: Role,
  filters: StaffListQuery,
  inactivityDays: number
): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [staffWhereForViewer(scope, viewerRole)];

  if (!filters.includeTest) and.push({ isTest: false });
  if (filters.roles.length) and.push({ role: { in: filters.roles } });
  if (filters.branchId) {
    and.push({ branchMembers: { some: { branchId: filters.branchId } } });
  }
  if (filters.statuses.length === 1) {
    and.push({ isActive: filters.statuses[0] === "active" });
  }
  if (filters.twoFa === "on") and.push({ totpEnabled: true });
  if (filters.twoFa === "off") and.push({ totpEnabled: false });

  const now = new Date();
  if (filters.lastActive === "never") {
    and.push({ lastLoginAt: null });
  } else if (filters.lastActive === "7" || filters.lastActive === "30" || filters.lastActive === "90") {
    const days = Number(filters.lastActive);
    const since = new Date(now);
    since.setDate(since.getDate() - days);
    and.push({ lastLoginAt: { gte: since } });
  }

  if (filters.q) {
    const q = filters.q;
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    });
  }

  return { AND: and };
}

export function staffOrderBy(
  sort: StaffListQuery["sort"],
  order: StaffListQuery["order"]
): Prisma.UserOrderByWithRelationInput[] {
  const dir = order;
  if (sort === "role") return [{ role: dir }, { name: "asc" }];
  if (sort === "joined") return [{ createdAt: dir }];
  if (sort === "lastActive") return [{ lastLoginAt: dir }, { name: "asc" }];
  return [{ name: dir }];
}

export type StaffTileCounts = {
  admins: number;
  managers: number;
  cashiers: number;
  chefs: number;
  riders: number;
  waiters: number;
  inactive: number;
  twoFaOff: number;
  total: number;
};

export async function aggregateStaffTiles(
  where: Prisma.UserWhereInput,
  requireTwoFa: boolean,
  graceDays: number
): Promise<StaffTileCounts> {
  const { prisma } = await import("../prisma");
  const [roleCounts, inactive, twoFaOff, total] = await Promise.all([
    prisma.user.groupBy({ by: ["role"], where, _count: { _all: true } }),
    prisma.user.count({ where: { AND: [where, { isActive: false }] } }),
    prisma.user.count({
      where: { AND: [where, { totpEnabled: false }] },
    }),
    prisma.user.count({ where }),
  ]);

  const countRole = (role: Role) => roleCounts.find((r) => r.role === role)?._count._all ?? 0;

  return {
    admins: countRole(Role.ADMIN),
    managers: countRole(Role.MANAGER),
    cashiers: countRole(Role.CASHIER),
    chefs: countRole(Role.CHEF),
    riders: countRole(Role.RIDER),
    waiters: countRole(Role.WAITER),
    inactive,
    twoFaOff,
    total,
  };
}
