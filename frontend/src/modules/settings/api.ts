import { api, ApiError } from "@/lib/api";
import type { StoreSettings } from "@/lib/types";
import type { SettingsSectionId } from "./ia";

export type SettingsFieldError = { code: string; message: string };

export type PatchSectionResponse = {
  settings: StoreSettings & { version: number };
  affectsStorefront?: boolean;
};

export type SettingsConflictPayload = {
  code: string;
  error: string;
  version: number;
  settings: StoreSettings & { version: number };
  diff?: Record<string, { yours: unknown; theirs: unknown }>;
  affectsStorefront?: boolean;
};

export async function patchSettingsSection(
  sectionId: SettingsSectionId,
  body: Record<string, unknown> & { version: number; confirm?: boolean }
): Promise<PatchSectionResponse> {
  return api<PatchSectionResponse>(`/settings/sections/${sectionId}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export async function fetchSettingsSectionHistory(sectionId: SettingsSectionId) {
  return api<{ entries: import("@/components/admin/settings/SettingsHistoryDrawer").SettingsHistoryEntry[] }>(
    `/settings/sections/${sectionId}/history`
  );
}

export async function restoreSettingsFromHistory(
  sectionId: SettingsSectionId,
  auditLogId: string,
  version: number,
  confirm?: boolean
) {
  return api<{ settings: StoreSettings & { version: number } }>(`/settings/sections/${sectionId}/restore`, {
    method: "POST",
    body: JSON.stringify({ auditLogId, version, confirm }),
  });
}

export function isSettingsConflict(err: unknown): err is ApiError & { payload?: SettingsConflictPayload } {
  return err instanceof ApiError && err.status === 409 && err.code === "SETTINGS_VERSION_CONFLICT";
}

export async function revalidateStorefront() {
  try {
    await fetch("/api/revalidate-store", { method: "POST", credentials: "include" });
  } catch {
    /* non-fatal */
  }
}
