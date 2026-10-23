import { prisma } from "../prisma";
import { STAFF_DIRECTORY_ROLES } from "../roles";
import {
  defaultOnForModule,
  moduleAccessForLevel,
  parseModuleAccess,
  parseModuleAccessInput,
  type ModuleAccess,
  type ModuleAccessLevel,
} from "./module-access";
import { PLAN_MODULE_DEFAULT_ON, PLAN_MODULE_IDS, type PlanModuleEntitlements, type PlanModuleId } from "./plan-modules";

export type PlanEntitlements = {
  maxBranches?: number | null;
  maxStaff?: number | null;
} & PlanModuleEntitlements;

function defaultModuleEntitlements(): PlanModuleEntitlements {
  const ent: PlanModuleEntitlements = {};
  for (const id of PLAN_MODULE_IDS) {
    ent[id] = PLAN_MODULE_DEFAULT_ON.includes(id);
  }
  return ent;
}

const FALLBACK: PlanEntitlements = {
  maxBranches: 1,
  maxStaff: 5,
  ...defaultModuleEntitlements(),
};

export class EntitlementError extends Error {
  status = 403;
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
  }
}

export function mergePlanEntitlements(base: PlanEntitlements, patch: PlanEntitlements): PlanEntitlements {
  return { ...base, ...patch };
}

export function parsePlanEntitlements(raw: unknown): PlanEntitlements {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const ent: PlanEntitlements = {};
  if ("maxBranches" in o) {
    ent.maxBranches =
      typeof o.maxBranches === "number" ? o.maxBranches : o.maxBranches === null ? null : undefined;
  }
  if ("maxStaff" in o) {
    ent.maxStaff = typeof o.maxStaff === "number" ? o.maxStaff : o.maxStaff === null ? null : undefined;
  }
  for (const id of PLAN_MODULE_IDS) {
    const parsed = parseModuleAccessInput(o[id]);
    if (parsed !== undefined) ent[id] = parsed;
  }
  return ent;
}

export function resolveModuleAccess(ent: PlanEntitlements, id: PlanModuleId): ModuleAccess {
  return parseModuleAccess(ent[id], defaultOnForModule(id));
}

export async function loadTenantEntitlements(): Promise<PlanEntitlements> {
  const subscription = await prisma.subscription.findFirst({
    include: {
      plan: { select: { entitlements: true, isActive: true } },
      pinnedPlanVersion: { select: { entitlements: true } },
    },
  });
  if (!subscription?.plan?.isActive) return { ...FALLBACK };
  const fromPlan = parsePlanEntitlements(
    subscription.pinnedPlanVersion?.entitlements ?? subscription.plan.entitlements
  );
  const overrides = parsePlanEntitlements(subscription.entitlementOverrides);
  return { ...FALLBACK, ...fromPlan, ...overrides };
}

export async function loadTenantBillingSummary() {
  const subscription = await prisma.subscription.findFirst({
    include: {
      plan: { select: { name: true, slug: true, pricePkr: true, interval: true, currency: true } },
    },
  });
  const openInvoice = subscription
    ? await prisma.platformInvoice.findFirst({
        where: { subscriptionId: subscription.id, status: "OPEN" },
        orderBy: { dueAt: "asc" },
      })
    : null;
  return { subscription, openInvoice };
}

export async function assertModuleAccess(id: PlanModuleId, level: ModuleAccessLevel) {
  const ent = await loadTenantEntitlements();
  const access = resolveModuleAccess(ent, id);
  if (!moduleAccessForLevel(access, level)) {
    const verb = level === "read" ? "view" : level === "edit" ? "change" : "delete";
    throw new EntitlementError(
      "PLAN_FEATURE",
      `Your plan does not allow ${verb} access for this feature. Contact support to upgrade.`
    );
  }
}

export async function assertEntitlement(feature: keyof PlanEntitlements) {
  if (feature === "maxBranches" || feature === "maxStaff") return;
  await assertModuleAccess(feature as PlanModuleId, "read");
}

export async function assertCanAddBranch() {
  await assertModuleAccess("branches", "edit");
  const ent = await loadTenantEntitlements();
  const limit = ent.maxBranches;
  if (limit == null) return;
  const count = await prisma.branch.count({ where: { isActive: true } });
  if (count >= limit) {
    throw new EntitlementError(
      "BRANCH_LIMIT",
      "You have reached the branch limit for your plan. Contact support to add more locations."
    );
  }
}

export async function assertCanAddStaff() {
  const ent = await loadTenantEntitlements();
  const limit = ent.maxStaff;
  if (limit == null) return;
  const count = await prisma.user.count({
    where: { isActive: true, role: { in: STAFF_DIRECTORY_ROLES } },
  });
  if (count >= limit) {
    throw new EntitlementError(
      "STAFF_LIMIT",
      "You have reached the staff limit for your plan. Contact support to add more team members."
    );
  }
}
