import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export async function evaluateFeatureFlag(key: string, restaurantId?: string) {
  return withoutTenant("evaluate feature flag", async () => {
    const flag = await basePrisma.platformFeatureFlag.findUnique({ where: { key } });
    if (!flag) return false;
    if (!restaurantId) return flag.defaultEnabled;
    const override = await basePrisma.platformTenantFeatureFlag.findUnique({
      where: { flagId_restaurantId: { flagId: flag.id, restaurantId } },
    });
    if (override) return override.enabled;
    return flag.defaultEnabled;
  });
}

export async function listFeatureFlagsForTenant(restaurantId: string) {
  return withoutTenant("tenant feature flags", async () => {
    const flags = await basePrisma.platformFeatureFlag.findMany({ orderBy: { key: "asc" } });
    const overrides = await basePrisma.platformTenantFeatureFlag.findMany({
      where: { restaurantId },
    });
    const byFlag = new Map(overrides.map((o) => [o.flagId, o.enabled]));
    return flags.map((f) => ({
      id: f.id,
      key: f.key,
      description: f.description,
      enabled: byFlag.has(f.id) ? byFlag.get(f.id)! : f.defaultEnabled,
      source: byFlag.has(f.id) ? ("override" as const) : ("default" as const),
    }));
  });
}
