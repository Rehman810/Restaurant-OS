import { Role } from "@prisma/client";
import type { NextAction } from "./next-actions";

export function maskPhoneForRole(phone: string, role: Role): string {
  if (role === Role.CHEF) {
    if (phone.length <= 4) return "****";
    return `${"*".repeat(Math.max(4, phone.length - 4))}${phone.slice(-4)}`;
  }
  return phone;
}

export function canSeePayment(role: Role) {
  return role !== Role.CHEF;
}

export function canSeeCustomerPhone(role: Role) {
  return role !== Role.CHEF;
}

export function canSeeIpLocation(role: Role) {
  return role === Role.ADMIN;
}

export function filterNextActionsForRole(actions: NextAction[], role: Role): NextAction[] {
  if (role === Role.RIDER) return [];
  if (role === Role.CHEF) {
    return actions.filter((a) => a.action === "transition" && a.targetStatus !== "CANCELLED");
  }
  return actions;
}
