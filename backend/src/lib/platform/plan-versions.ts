import type { Plan } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export async function latestPlanVersion(planId: string) {
  return withoutTenant("latest plan version", () =>
    basePrisma.planVersion.findFirst({
      where: { planId },
      orderBy: { version: "desc" },
    })
  );
}

export async function snapshotPlanVersion(plan: Pick<Plan, "id" | "pricePkr" | "entitlements">) {
  return withoutTenant("snapshot plan version", async () => {
    const latest = await latestPlanVersion(plan.id);
    const version = (latest?.version ?? 0) + 1;
    return basePrisma.planVersion.create({
      data: {
        planId: plan.id,
        version,
        pricePkr: plan.pricePkr,
        entitlements: plan.entitlements ?? {},
      },
    });
  });
}

export async function ensureInitialPlanVersion(plan: Pick<Plan, "id" | "pricePkr" | "entitlements">) {
  const latest = await latestPlanVersion(plan.id);
  if (latest) return latest;
  return snapshotPlanVersion(plan);
}
