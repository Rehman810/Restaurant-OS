export const PLATFORM_MAINTENANCE_EVENT = "uff-platform-maintenance";

export type PlatformMaintenanceDetail = { active: boolean; message: string };

export function dispatchPlatformMaintenance(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(PLATFORM_MAINTENANCE_EVENT, {
      detail: { active: true, message },
    })
  );
}
