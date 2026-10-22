import { TenantStatus } from "@prisma/client";

export type TenantAccess = {
  status: TenantStatus;
  resolvable: boolean;
  allowStorefrontOrders: boolean;
  allowStaffLogin: boolean;
  adminReadOnly: boolean;
  publicMessage: string;
};

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function cancelRetentionDays() {
  return Math.max(1, Number(process.env.TENANT_CANCEL_RETENTION_DAYS || 30));
}

export function tenantAccessForStatus(status: TenantStatus, statusReason = ""): TenantAccess {
  const reason = statusReason.trim();
  switch (status) {
    case TenantStatus.ACTIVE:
    case TenantStatus.TRIAL:
      return {
        status,
        resolvable: true,
        allowStorefrontOrders: true,
        allowStaffLogin: true,
        adminReadOnly: false,
        publicMessage: "",
      };
    case TenantStatus.PAST_DUE:
      return {
        status,
        resolvable: true,
        allowStorefrontOrders: false,
        allowStaffLogin: true,
        adminReadOnly: true,
        publicMessage: reason || "Your subscription payment is due. Pay the open invoice to restore full access.",
      };
    case TenantStatus.LEAD:
      return {
        status,
        resolvable: true,
        allowStorefrontOrders: false,
        allowStaffLogin: false,
        adminReadOnly: true,
        publicMessage: reason || "This store is not open yet.",
      };
    case TenantStatus.SUSPENDED:
      return {
        status,
        resolvable: true,
        allowStorefrontOrders: false,
        allowStaffLogin: true,
        adminReadOnly: true,
        publicMessage: reason || "This store is temporarily unavailable.",
      };
    case TenantStatus.CANCELLED:
      return {
        status,
        resolvable: true,
        allowStorefrontOrders: false,
        allowStaffLogin: false,
        adminReadOnly: true,
        publicMessage: reason || "This store has been closed.",
      };
    case TenantStatus.ARCHIVED:
    default:
      return {
        status: TenantStatus.ARCHIVED,
        resolvable: false,
        allowStorefrontOrders: false,
        allowStaffLogin: false,
        adminReadOnly: true,
        publicMessage: "",
      };
  }
}

const ALLOWED_TRANSITIONS: Record<TenantStatus, TenantStatus[]> = {
  [TenantStatus.LEAD]: [TenantStatus.TRIAL, TenantStatus.ACTIVE, TenantStatus.CANCELLED],
  [TenantStatus.TRIAL]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CANCELLED, TenantStatus.PAST_DUE],
  [TenantStatus.ACTIVE]: [TenantStatus.PAST_DUE, TenantStatus.SUSPENDED, TenantStatus.CANCELLED, TenantStatus.TRIAL],
  [TenantStatus.PAST_DUE]: [TenantStatus.ACTIVE, TenantStatus.SUSPENDED, TenantStatus.CANCELLED],
  [TenantStatus.SUSPENDED]: [TenantStatus.ACTIVE, TenantStatus.CANCELLED],
  [TenantStatus.CANCELLED]: [TenantStatus.ACTIVE],
  [TenantStatus.ARCHIVED]: [],
};

export function assertTenantStatusTransition(from: TenantStatus, to: TenantStatus) {
  if (from === to) return;
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw Object.assign(new Error(`Cannot change status from ${from} to ${to}.`), { status: 400, code: "INVALID_STATUS_TRANSITION" });
  }
}

export function lifecycleScheduleForStatus(status: TenantStatus, now = new Date()) {
  if (status === TenantStatus.CANCELLED) {
    const deleteScheduledAt = new Date(now);
    deleteScheduledAt.setUTCDate(deleteScheduledAt.getUTCDate() + cancelRetentionDays());
    return { deleteScheduledAt, archivedAt: null as Date | null };
  }
  if (status === TenantStatus.ACTIVE || status === TenantStatus.TRIAL) {
    return { deleteScheduledAt: null as Date | null, archivedAt: null as Date | null };
  }
  return {};
}

function pathMatches(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

/** Routes that stay writable when the tenant is in billing-related read-only mode. */
function isSubscriptionBillingExempt(path: string) {
  return (
    pathMatches(path, "/admin/billing") ||
    pathMatches(path, "/admin/announcements") ||
    path === "/auth/logout" ||
    path === "/auth/logout-all" ||
    path === "/auth/login" ||
    path === "/auth/support-exchange" ||
    path.startsWith("/auth/login/")
  );
}

export function lifecycleGate(
  access: TenantAccess,
  method: string,
  path: string
): { blocked: boolean; status: number; code?: string; error?: string } {
  if (!access.resolvable) {
    return { blocked: true, status: 404, error: "Not found." };
  }
  const m = method.toUpperCase();
  const read = SAFE.has(m);

  if (m === "POST" && path === "/auth/login" && !access.allowStaffLogin) {
    return {
      blocked: true,
      status: 403,
      code: "TENANT_ACCESS_LIMITED",
      error: access.publicMessage || "Sign-in is not available for this store.",
    };
  }
  if (m === "POST" && path === "/auth/register" && !access.allowStorefrontOrders) {
    return {
      blocked: true,
      status: 403,
      code: "TENANT_ACCESS_LIMITED",
      error: access.publicMessage || "New accounts are not available right now.",
    };
  }
  if (m === "POST" && path === "/orders" && !access.allowStorefrontOrders) {
    return {
      blocked: true,
      status: 403,
      code: "TENANT_ACCESS_LIMITED",
      error: access.publicMessage || "Online ordering is not available right now.",
    };
  }
  if (m === "POST" && pathMatches(path, "/dine-in") && !access.allowStorefrontOrders) {
    return {
      blocked: true,
      status: 403,
      code: "TENANT_ACCESS_LIMITED",
      error: access.publicMessage || "Bookings are not available right now.",
    };
  }

  if (access.adminReadOnly && !read) {
    const exempt = isSubscriptionBillingExempt(path);
    if (!exempt) {
      return {
        blocked: true,
        status: 403,
        code: "TENANT_READ_ONLY",
        error: "Changes are disabled for this store. Contact support if you need help.",
      };
    }
  }

  return { blocked: false, status: 200 };
}
