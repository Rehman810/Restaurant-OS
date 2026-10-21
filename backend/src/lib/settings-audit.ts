import type { SettingsSectionId } from "./settings-sections";
import { SETTINGS_SECTION_FIELDS } from "./settings-section-fields";
import { isRestorableSettingsChange } from "./settings-dangerous";

export type SettingsAuditMeta = {
  sectionId: SettingsSectionId;
  sectionLabel?: string;
  changedKeys: string[];
};

export function settingsAuditMeta(
  sectionId: SettingsSectionId,
  changedKeys: string[],
  sectionLabel?: string
): SettingsAuditMeta {
  return { sectionId, sectionLabel, changedKeys };
}

export function sectionForAuditKey(key: string): SettingsSectionId | null {
  for (const [sectionId, keys] of Object.entries(SETTINGS_SECTION_FIELDS) as [SettingsSectionId, readonly string[]][]) {
    if (keys.includes(key)) return sectionId;
  }
  return null;
}

export function entryIsRestorable(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  const keys = Object.keys(after);
  return keys.length > 0 && isRestorableSettingsChange(keys);
}
