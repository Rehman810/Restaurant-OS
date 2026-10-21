import type { StoreSettings } from "@prisma/client";

export type OrderAlertThresholds = {
  lateConfirmMinutes: number;
  latePrepMinutes: number;
  lateDeliveryMinutes: number;
};

/** Single source for dashboard / board “late order” timing (legacy SLA columns are fallbacks only). */
export function orderAlertThresholds(settings: StoreSettings): OrderAlertThresholds {
  return {
    lateConfirmMinutes: settings.lateConfirmMinutes ?? settings.confirmSlaMinutes ?? 15,
    latePrepMinutes: settings.latePrepMinutes ?? 30,
    lateDeliveryMinutes:
      settings.lateDeliveryMinutes ?? settings.deliverySlaMinutes ?? 45,
  };
}

/** Keep deprecated columns aligned when admins save Alert thresholds. */
export function legacySlaMirrorFromAlertThresholds(
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...patch };
  if (patch.lateConfirmMinutes !== undefined) {
    out.confirmSlaMinutes = patch.lateConfirmMinutes;
  }
  if (patch.lateDeliveryMinutes !== undefined) {
    out.deliverySlaMinutes = patch.lateDeliveryMinutes;
  }
  return out;
}
