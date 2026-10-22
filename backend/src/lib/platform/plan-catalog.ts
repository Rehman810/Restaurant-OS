import { PlanInterval } from "@prisma/client";
import type { PlanEntitlements } from "./entitlements";
import { parseModuleAccessInput } from "./module-access";
import { PLAN_MODULE_IDS } from "./plan-modules";

export function normalizePlanSlug(raw: string) {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug || slug.length < 2) {
    throw Object.assign(new Error("Plan slug must be at least 2 characters."), { status: 400 });
  }
  return slug;
}

export function parsePlanEntitlementsInput(raw: unknown): PlanEntitlements {
  if (!raw || typeof raw !== "object") {
    throw Object.assign(new Error("Entitlements must be an object."), { status: 400 });
  }
  const o = raw as Record<string, unknown>;
  const ent: PlanEntitlements = {};
  if (o.maxBranches === null) ent.maxBranches = null;
  else if (typeof o.maxBranches === "number" && o.maxBranches >= 0) ent.maxBranches = Math.floor(o.maxBranches);
  if (o.maxStaff === null) ent.maxStaff = null;
  else if (typeof o.maxStaff === "number" && o.maxStaff >= 0) ent.maxStaff = Math.floor(o.maxStaff);
  for (const id of PLAN_MODULE_IDS) {
    const parsed = parseModuleAccessInput(o[id]);
    if (parsed !== undefined) ent[id] = parsed;
  }
  return ent;
}

export function parsePlanInterval(raw: unknown): PlanInterval {
  const v = String(raw || "MONTHLY").toUpperCase();
  if (v === "YEARLY") return PlanInterval.YEARLY;
  return PlanInterval.MONTHLY;
}
