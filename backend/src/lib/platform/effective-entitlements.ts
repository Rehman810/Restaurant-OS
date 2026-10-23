import { mergePlanEntitlements, parsePlanEntitlements, type PlanEntitlements } from "./entitlements";

export function mergeEntitlements(
  planEntitlements: unknown,
  versionEntitlements: unknown | null | undefined,
  overrides: unknown
): PlanEntitlements {
  const base = parsePlanEntitlements(versionEntitlements ?? planEntitlements);
  const patch = parsePlanEntitlements(overrides);
  return mergePlanEntitlements(base, patch);
}
