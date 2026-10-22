import type { PlatformRole } from "./types";

export type PlatformPermission =
  | "tenants:read"
  | "tenants:write"
  | "billing:read"
  | "billing:write"
  | "plans:read"
  | "audit:read"
  | "notes:write"
  | "support:write";

export const NAV_PERMISSIONS: Record<string, PlatformPermission> = {
  "/overview": "tenants:read",
  "/tenants": "tenants:read",
  "/announcements": "tenants:read",
  "/audit": "audit:read",
  "/health": "tenants:read",
  "/settings": "tenants:read",
};

export function canAccess(permissions: PlatformPermission[] | undefined, permission: PlatformPermission) {
  return permissions?.includes(permission) ?? false;
}

export function canAccessNav(permissions: PlatformPermission[] | undefined, href: string) {
  const required = NAV_PERMISSIONS[href];
  if (!required) return true;
  return canAccess(permissions, required);
}

export function roleLabel(role: PlatformRole) {
  return role.replace(/_/g, " ");
}
