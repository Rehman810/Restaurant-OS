import { Role } from "@prisma/client";
import type { AuthUser } from "../../middleware/auth";

export function displayNameFromUser(user: { name: string; email: string }): string {
  const name = user.name?.trim();
  if (name && !name.includes("@")) return name;
  const local = user.email.split("@")[0] ?? user.email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" ");
  }
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function maskPhone(phone: string | null | undefined, viewer: AuthUser, targetRole: Role): string | null {
  if (!phone?.trim()) return null;
  if (viewer.role === Role.ADMIN) return phone;
  if (viewer.role === Role.MANAGER && (targetRole === Role.ADMIN || targetRole === Role.MANAGER)) {
    const digits = phone.replace(/\D/g, "");
    if (digits.length <= 4) return "••••";
    return `•••• ${digits.slice(-4)}`;
  }
  return phone;
}

export function accessSummary(input: {
  role: Role;
  isOwner: boolean;
  branchNames: string[];
}): string {
  if (input.isOwner) return "Owner: full access";
  if (input.role === Role.ADMIN) return "Admin: full access";
  if (input.role === Role.MANAGER) {
    const b = input.branchNames[0];
    return b ? `Manager: ${b}${input.branchNames.length > 1 ? ` +${input.branchNames.length - 1}` : ""}` : "Manager: branch access";
  }
  if (input.role === Role.CASHIER) return "Cashier: POS, Orders";
  if (input.role === Role.CHEF) return "Chef: Kitchen";
  if (input.role === Role.RIDER) return "Rider: Deliveries";
  if (input.role === Role.WAITER) return "Waiter: Dine-in, POS";
  return `${input.role}: staff`;
}

export function twoFaCompliance(input: {
  role: Role;
  totpEnabled: boolean;
  createdAt: Date;
  requireTwoFa: boolean;
  graceDays: number;
  now?: Date;
}): { compliant: boolean; required: boolean; graceEndsAt: string | null } {
  const required =
    input.requireTwoFa && (input.role === Role.ADMIN || input.role === Role.MANAGER);
  if (!required) {
    return { compliant: true, required: false, graceEndsAt: null };
  }
  const now = input.now ?? new Date();
  const graceEnds = new Date(input.createdAt);
  graceEnds.setDate(graceEnds.getDate() + Math.max(1, input.graceDays));
  const compliant = input.totpEnabled || now <= graceEnds;
  return {
    compliant,
    required: true,
    graceEndsAt: graceEnds.toISOString(),
  };
}

export function maskIp(ip: string | null | undefined): string | null {
  if (!ip?.trim()) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":");
    return parts.length > 2 ? `${parts.slice(0, 3).join(":")}:…` : ip;
  }
  const octets = ip.split(".");
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.xxx.xxx`;
  return ip;
}
