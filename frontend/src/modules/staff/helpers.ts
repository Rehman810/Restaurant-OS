import { Role, User } from "@/lib/types";
import type { StaffListRow } from "./types";

export function staffDisplayName(row: Pick<StaffListRow, "displayName" | "name" | "email">): string {
  if (row.displayName?.trim()) return row.displayName.trim();
  const name = row.name?.trim();
  if (name && !name.includes("@")) return name;
  const local = row.email.split("@")[0] ?? row.email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function lastActiveLabel(lastActiveAt: string | null | undefined): string {
  if (!lastActiveAt) return "Never logged in";
  const ms = Date.now() - new Date(lastActiveAt).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days >= 90) return "Inactive 90+ days";
  if (days >= 30) return `Last active ${days}d ago`;
  if (days >= 7) return `Last active ${days}d ago`;
  const hrs = Math.floor(ms / (60 * 60 * 1000));
  if (hrs < 24) return hrs <= 0 ? "Active today" : `Last active ${hrs}h ago`;
  return `Last active ${days}d ago`;
}

export function twoFaStatusLabel(row: StaffListRow): { text: string; warn: boolean } {
  const on = row.twoFaEnabled ?? row.totpEnabled;
  if (on) return { text: "On", warn: false };
  if (row.twoFaRequired && row.twoFaCompliant === false) {
    return { text: "Required", warn: true };
  }
  return { text: "Off", warn: false };
}

const ROLE_AVATAR_CLASS: Record<Role, string> = {
  ADMIN: "bg-stone-700 text-white dark:bg-stone-200 dark:text-stone-900",
  MANAGER: "bg-stone-600 text-white dark:bg-stone-300 dark:text-stone-900",
  CASHIER: "bg-stone-500 text-white",
  CHEF: "bg-brand-600 text-white",
  RIDER: "bg-stone-500 text-white",
  WAITER: "bg-stone-500 text-white",
  CUSTOMER: "bg-stone-400 text-white",
};

export function avatarClassForRole(role: Role): string {
  return ROLE_AVATAR_CLASS[role] ?? "bg-stone-500 text-white";
}

export function canManageStaff(actor: User | null): boolean {
  return actor?.role === "ADMIN" || actor?.role === "MANAGER";
}

export function creatableRoles(actor: User | null): Role[] {
  if (!actor) return [];
  if (actor.isOwner) return ["ADMIN", "MANAGER", "WAITER", "CHEF", "RIDER", "CASHIER"];
  if (actor.role === "ADMIN") return ["MANAGER", "WAITER", "CHEF", "RIDER", "CASHIER"];
  if (actor.role === "MANAGER") return ["WAITER", "CHEF", "RIDER", "CASHIER"];
  return [];
}

export function canEditStaffMember(actor: User | null, target: StaffListRow): boolean {
  if (!actor || !canManageStaff(actor)) return false;
  if (actor.id === target.id) return true;
  if (actor.role === "MANAGER") {
    if (target.role === "ADMIN" || target.isOwner) return false;
    if (target.role === "MANAGER") return false;
  }
  if (target.isOwner && !actor.isOwner) return false;
  return true;
}

export function canShowStaffAction(
  actor: User | null,
  action: "edit" | "role" | "branches" | "resetPassword" | "reset2fa" | "pin" | "sessions" | "deactivate",
  target: StaffListRow
): boolean {
  if (!canEditStaffMember(actor, target)) return false;
  if (action === "sessions" || action === "reset2fa") return actor?.role === "ADMIN";
  if (action === "role" && target.isOwner) return false;
  if (action === "deactivate" && target.isOwner) return false;
  if (action === "pin") return target.role === "ADMIN" || target.role === "MANAGER";
  return true;
}
