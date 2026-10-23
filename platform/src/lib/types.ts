export type PlatformRole = "SUPER_ADMIN" | "ADMIN" | "BILLING" | "SUPPORT" | "READONLY";

export type PlatformPermission =
  | "tenants:read"
  | "tenants:write"
  | "billing:read"
  | "billing:write"
  | "plans:read"
  | "plans:write"
  | "audit:read"
  | "notes:write"
  | "support:write"
  | "platform_users:read"
  | "platform_users:write"
  | "security:write"
  | "flags:read"
  | "flags:write";

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  totpEnabled?: boolean;
  permissions?: PlatformPermission[];
};

export type TenantRow = {
  id: string;
  slug: string;
  displayName: string;
  isTest?: boolean;
  hostname: string | null;
  status: string;
  statusReason: string;
  ownerName: string;
  ownerEmail: string;
  city: string;
  createdAt: string;
  subscription?: {
    status: string;
    plan: { slug: string; name: string };
    currentPeriodEnd: string;
  } | null;
};
