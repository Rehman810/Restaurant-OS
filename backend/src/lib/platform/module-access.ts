import { PLAN_MODULE_DEFAULT_ON, type PlanModuleId } from "./plan-modules";

export type ModuleAccess = { read: boolean; edit: boolean; delete: boolean };
export type ModuleAccessLevel = "read" | "edit" | "delete";
export type ModuleAccessInput = boolean | ModuleAccess;

export const MODULE_ACCESS_LEVELS: ModuleAccessLevel[] = ["read", "edit", "delete"];

export function fullModuleAccess(): ModuleAccess {
  return { read: true, edit: true, delete: true };
}

export function noModuleAccess(): ModuleAccess {
  return { read: false, edit: false, delete: false };
}

export function isFullModuleAccess(a: ModuleAccess): boolean {
  return a.read && a.edit && a.delete;
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

export function parseModuleAccessInput(raw: unknown): ModuleAccessInput | undefined {
  if (raw === true || raw === false) return raw;
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.read !== "boolean" && typeof o.edit !== "boolean" && typeof o.delete !== "boolean") {
    return undefined;
  }
  return {
    read: o.read === true,
    edit: o.edit === true,
    delete: o.delete === true,
  };
}

export function moduleAccessForLevel(access: ModuleAccess, level: ModuleAccessLevel): boolean {
  return access[level] === true;
}

export function defaultOnForModule(id: PlanModuleId): boolean {
  return PLAN_MODULE_DEFAULT_ON.includes(id);
}

export function accessLevelForHttpMethod(method: string): ModuleAccessLevel {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return "read";
  if (m === "DELETE") return "delete";
  return "edit";
}
