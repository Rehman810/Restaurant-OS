import { PlatformRole } from "@prisma/client";

export type PlatformPermission =
  | "tenants:read"
  | "tenants:write"
  | "billing:read"
  | "billing:write"
  | "plans:read"
  | "audit:read"
  | "notes:write"
  | "support:write";

const ALL: PlatformPermission[] = [
  "tenants:read",
  "tenants:write",
  "billing:read",
  "billing:write",
  "plans:read",
  "audit:read",
  "notes:write",
  "support:write",
];

const MATRIX: Record<PlatformRole, PlatformPermission[]> = {
  [PlatformRole.SUPER_ADMIN]: ALL,
  [PlatformRole.ADMIN]: [
    "tenants:read",
    "tenants:write",
    "billing:read",
    "plans:read",
    "audit:read",
    "notes:write",
    "support:write",
  ],
  [PlatformRole.BILLING]: ["tenants:read", "billing:read", "billing:write", "plans:read", "audit:read"],
  [PlatformRole.SUPPORT]: ["tenants:read", "plans:read", "audit:read", "notes:write", "support:write"],
  [PlatformRole.READONLY]: ["tenants:read", "billing:read", "plans:read", "audit:read"],
};

export function platformHasPermission(role: PlatformRole, permission: PlatformPermission) {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function permissionsForRole(role: PlatformRole): PlatformPermission[] {
  return MATRIX[role] ?? [];
}
