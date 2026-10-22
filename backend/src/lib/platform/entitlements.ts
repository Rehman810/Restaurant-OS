import { prisma } from "../prisma";
import { STAFF_DIRECTORY_ROLES } from "../roles";

export type PlanEntitlements = {
  maxBranches?: number | null;
  maxStaff?: number | null;
  inventory?: boolean;
  dineIn?: boolean;
  pos?: boolean;
  analytics?: boolean;
};

const FALLBACK: PlanEntitlements = {
  maxBranches: 1,
  maxStaff: 5,
  inventory: false,
  dineIn: false,
  pos: true,
  analytics: false,
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

function parseEntitlements(raw: unknown): PlanEntitlements {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    maxBranches: typeof o.maxBranches === "number" ? o.maxBranches : o.maxBranches === null ? null : undefined,
    maxStaff: typeof o.maxStaff === "number" ? o.maxStaff : o.maxStaff === null ? null : undefined,
    inventory: typeof o.inventory === "boolean" ? o.inventory : undefined,
    dineIn: typeof o.dineIn === "boolean" ? o.dineIn : undefined,
    pos: typeof o.pos === "boolean" ? o.pos : undefined,
    analytics: typeof o.analytics === "boolean" ? o.analytics : undefined,
  };
}

export async function loadTenantEntitlements(): Promise<PlanEntitlements> {
  const subscription = await prisma.subscription.findFirst({
    include: { plan: { select: { entitlements: true, isActive: true } } },
  });
  if (!subscription?.plan?.isActive) return { ...FALLBACK };
  const fromPlan = parseEntitlements(subscription.plan.entitlements);
  return { ...FALLBACK, ...fromPlan };
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

export async function assertEntitlement(feature: keyof PlanEntitlements) {
  const ent = await loadTenantEntitlements();
  const value = ent[feature];
  if (feature === "maxBranches" || feature === "maxStaff") return;
  if (value === false) {
    throw new EntitlementError(
      "PLAN_FEATURE",
      "This feature is not included in your current plan. Contact support to upgrade."
    );
  }
}

export async function assertCanAddBranch() {
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
