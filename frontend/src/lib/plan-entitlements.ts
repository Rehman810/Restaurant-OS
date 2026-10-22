import {
  PLAN_MODULE_IDS,
  planModuleForNavHref,
  type PlanModuleId,
} from "./plan-modules";
import {
  defaultOnForModule,
  moduleAccessForLevel,
  parseModuleAccess,
  type ModuleAccess,
  type ModuleAccessLevel,
} from "./module-access";

export type TenantEntitlements = {
  maxBranches?: number | null;
  maxStaff?: number | null;
  modules: Record<PlanModuleId, ModuleAccess>;
};

const ALWAYS_ALLOWED_PREFIXES = ["/admin/billing", "/admin/settings"];

export function resolveModuleAccess(ent: TenantEntitlements, id: PlanModuleId): ModuleAccess {
  return ent.modules[id] ?? parseModuleAccess(undefined, defaultOnForModule(id));
}

export function isPlanModuleEnabled(ent: TenantEntitlements, id: PlanModuleId): boolean {
  return resolveModuleAccess(ent, id).read;
}

export function hasPlanModuleAccess(ent: TenantEntitlements, id: PlanModuleId, level: ModuleAccessLevel): boolean {
  return moduleAccessForLevel(resolveModuleAccess(ent, id), level);
}

export function normalizeEntitlements(raw: Record<string, unknown> | null | undefined): TenantEntitlements {
  const modules = {} as Record<PlanModuleId, ModuleAccess>;
  for (const id of PLAN_MODULE_IDS) {
    modules[id] = parseModuleAccess(raw?.[id], defaultOnForModule(id));
  }
  return {
    maxBranches: raw?.maxBranches as number | null | undefined,
    maxStaff: raw?.maxStaff as number | null | undefined,
    modules,
  };
}

function pathMatchesPrefix(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix);
}

export function moduleForAdminPath(path: string): PlanModuleId | null {
  return planModuleForNavHref(path);
}

export function adminPathAllowedByPlan(path: string, ent: TenantEntitlements): boolean {
  const p = path.split("?")[0];
  if (ALWAYS_ALLOWED_PREFIXES.some((prefix) => pathMatchesPrefix(p, prefix))) return true;
  const mod = moduleForAdminPath(p);
  if (!mod) {
    if (p.startsWith("/admin/")) return false;
    return true;
  }
  return isPlanModuleEnabled(ent, mod);
}

export function filterNavHref(href: string, ent: TenantEntitlements): boolean {
  return adminPathAllowedByPlan(href, ent);
}
