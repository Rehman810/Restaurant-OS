import { PLAN_MODULE_DEFAULT_ON, type PlanModuleId } from "./plan-modules";

export type ModuleAccess = { read: boolean; edit: boolean; delete: boolean };
export type ModuleAccessLevel = "read" | "edit" | "delete";

export const MODULE_ACCESS_LEVELS: ModuleAccessLevel[] = ["read", "edit", "delete"];

export function fullModuleAccess(): ModuleAccess {
  return { read: true, edit: true, delete: true };
}

export function noModuleAccess(): ModuleAccess {
  return { read: false, edit: false, delete: false };
}

export function parseModuleAccess(raw: unknown, defaultOn: boolean): ModuleAccess {
  if (raw === true) return fullModuleAccess();
  if (raw === false) return noModuleAccess();
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    return {
      read: o.read === true,
      edit: o.edit === true,
      delete: o.delete === true,
    };
  }
  return defaultOn ? fullModuleAccess() : noModuleAccess();
}

export function defaultOnForModule(id: PlanModuleId): boolean {
  return PLAN_MODULE_DEFAULT_ON.includes(id);
}

export function moduleAccessForLevel(access: ModuleAccess, level: ModuleAccessLevel): boolean {
  return access[level] === true;
}
