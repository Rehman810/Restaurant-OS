import { Role } from "@prisma/client";
import { prisma } from "../prisma";
import { runWithRestaurant } from "../restaurant-context";
import { PLAN_MODULE_IDS, type PlanModuleId } from "./plan-modules";
import { mergeEntitlements } from "./effective-entitlements";
import { addKarachiDays, karachiDateOnly } from "./karachi-time";

export function parseEntitlementsFromJson(raw: unknown) {
  if (!raw || typeof raw !== "object") return {} as Record<string, unknown>;
  return raw as Record<string, unknown>;
}

export async function loadTenantUsageSummary(restaurantId: string) {
  return runWithRestaurant(restaurantId, async () => {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        tags: true,
        domains: { select: { id: true, hostname: true, isPrimary: true, verifiedAt: true } },
        subscription: {
          include: {
            plan: { select: { name: true, slug: true, entitlements: true, pricePkr: true } },
            pinnedPlanVersion: true,
          },
        },
      },
    });
    if (!restaurant) return null;

    const limits = mergeEntitlements(
      restaurant.subscription?.plan?.entitlements,
      restaurant.subscription?.pinnedPlanVersion?.entitlements,
      restaurant.subscription?.entitlementOverrides
    );

    const [branchCount, staffCount, lastLogin, usage30] = await Promise.all([
      prisma.branch.count({ where: { restaurantId, isActive: true } }),
      prisma.user.count({
        where: { restaurantId, isActive: true, role: { not: Role.CUSTOMER } },
      }),
      prisma.user.aggregate({
        where: { restaurantId, isActive: true, lastLoginAt: { not: null } },
        _max: { lastLoginAt: true },
      }),
      prisma.tenantUsageDaily.aggregate({
        where: { restaurantId, usageDate: { gte: karachiDateOnly(addKarachiDays(new Date(), -30)) } },
        _sum: { ordersCount: true, collectedPkr: true },
      }),
    ]);

    const maxBranches = limits.maxBranches as number | null | undefined;
    const maxStaff = limits.maxStaff as number | null | undefined;

    const modules = PLAN_MODULE_IDS.map((id) => ({
      id,
      enabled: Boolean(limits[id as PlanModuleId]),
    }));

    return {
      tags: restaurant.tags,
      lastActiveAt: lastLogin._max.lastLoginAt?.toISOString() ?? null,
      domains: restaurant.domains.map((d) => ({
        ...d,
        status: d.verifiedAt ? "verified" : "pending",
      })),
      limits: {
        maxBranches: maxBranches ?? null,
        maxStaff: maxStaff ?? null,
      },
      usage: {
        branches: branchCount,
        staff: staffCount,
        ordersLast30Days: usage30._sum.ordersCount ?? 0,
        collectedPkrLast30Days: usage30._sum.collectedPkr ?? 0,
      },
      modules,
      pinnedPlanVersion: restaurant.subscription?.pinnedPlanVersion
        ? {
            id: restaurant.subscription.pinnedPlanVersion.id,
            version: restaurant.subscription.pinnedPlanVersion.version,
          }
        : null,
      entitlementOverrides: restaurant.subscription?.entitlementOverrides ?? {},
      plan: restaurant.subscription?.plan
        ? { name: restaurant.subscription.plan.name, slug: restaurant.subscription.plan.slug }
        : null,
    };
  });
}
