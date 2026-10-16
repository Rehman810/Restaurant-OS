import { Role } from "@prisma/client";
import type { getStoreSettings } from "./settings-data";
import {
  APPROVAL_REQUIRED_CODE,
  APPROVAL_REQUIRED_ERROR,
  managerActsDirectly,
  verifyApprovalPin,
} from "./approval-pin";

export type ApprovalPayload = {
  approverId?: string;
  pin?: string;
};

export type SensitiveAction = "VOID" | "REFUND" | "DISCOUNT" | "PRICE_OVERRIDE";

type StoreControls = Awaited<ReturnType<typeof getStoreSettings>>;

export function requiresApprovalFor(
  action: SensitiveAction,
  requesterRole: Role,
  settings: StoreControls
) {
  if (managerActsDirectly(requesterRole)) return false;
  if (action === "VOID") return settings.requireApprovalForVoid;
  if (action === "REFUND") return settings.requireApprovalForRefund;
  if (action === "PRICE_OVERRIDE") return settings.requireApprovalForPriceOverride;
  if (action === "DISCOUNT") return false;
  return true;
}

export function discountNeedsManagerApproval(
  requesterRole: Role,
  discountPercent: number,
  settings: StoreControls
) {
  if (managerActsDirectly(requesterRole)) return false;
  if (discountPercent <= 0) return false;
  return discountPercent > Number(settings.maxCashierDiscountPercent ?? 10);
}

export async function resolveSensitiveApproval(
  action: SensitiveAction,
  requester: { id: string; role: Role },
  settings: StoreControls,
  approval: ApprovalPayload | undefined,
  auditMeta?: { ip?: string }
): Promise<
  | { ok: true; approverId: string }
  | { ok: false; status: number; error: string; code: string }
> {
  if (!requiresApprovalFor(action, requester.role, settings)) {
    return { ok: true, approverId: requester.id };
  }
  const approverId = approval?.approverId?.trim();
  const pin = approval?.pin?.trim();
  if (!approverId || !pin) {
    return {
      ok: false,
      status: 403,
      error: APPROVAL_REQUIRED_ERROR,
      code: APPROVAL_REQUIRED_CODE,
    };
  }
  const verified = await verifyApprovalPin(approverId, pin, {
    ip: auditMeta?.ip,
    requesterId: requester.id,
  });
  if (!verified.ok) {
    return {
      ok: false,
      status: verified.status,
      error: verified.error,
      code: verified.code || "INVALID_PIN",
    };
  }
  return { ok: true, approverId: verified.approver.id };
}

export function parseReasonList(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json.map((x) => String(x).trim()).filter(Boolean);
}

export function validateReasonCode(code: string, options: string[]) {
  if (!code.trim()) return false;
  if (!options.length) return true;
  return options.includes(code.trim());
}

const STAFF_ORDER_ROLES: Role[] = [Role.CASHIER, Role.WAITER, Role.CHEF, Role.RIDER];

export function isStaffOrderActor(role: Role | undefined) {
  return role != null && STAFF_ORDER_ROLES.includes(role);
}

export async function resolveStaffVoidApproval(
  actor: { id: string; role: Role } | undefined,
  settings: StoreControls,
  body: {
    reason?: string;
    voidReasonCode?: string;
    voidReasonNote?: string;
    approval?: ApprovalPayload;
  },
  customerSelfCancel: boolean,
  auditMeta?: { ip?: string }
): Promise<
  | { ok: true; reasonCode: string; reasonNote: string | null; approverId: string | null }
  | { ok: false; status: number; error: string; code: string }
> {
  if (customerSelfCancel) {
    const reason = String(body.reason || body.voidReasonCode || "").trim();
    if (!reason) {
      return { ok: false, status: 400, error: "A reason is required to cancel an order.", code: "REASON_REQUIRED" };
    }
    return { ok: true, reasonCode: reason, reasonNote: body.voidReasonNote?.trim() || null, approverId: null };
  }
  if (!actor) {
    return { ok: false, status: 401, error: "Sign in required.", code: "UNAUTHORIZED" };
  }
  const reasons = parseReasonList(settings.voidReasonOptions);
  const code = String(body.voidReasonCode || body.reason || "").trim();
  if (!validateReasonCode(code, reasons)) {
    return { ok: false, status: 400, error: "Select a void reason.", code: "REASON_REQUIRED" };
  }
  const resolved = await resolveSensitiveApproval("VOID", actor, settings, body.approval, auditMeta);
  if (!resolved.ok) {
    return { ok: false, status: resolved.status, error: resolved.error, code: resolved.code };
  }
  return {
    ok: true,
    reasonCode: code,
    reasonNote: body.voidReasonNote?.trim() || null,
    approverId: resolved.approverId,
  };
}
