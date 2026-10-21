import {
  dangerousImpactText,
  listDangerousChanges,
  type DangerousSettingKey,
} from "./settings-dangerous";

export function checkDangerousSettingsConfirm(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
  confirm: unknown
):
  | { ok: true }
  | {
      ok: false;
      dangerous: DangerousSettingKey[];
      impacts: { key: DangerousSettingKey; text: string }[];
    } {
  const dangerous = listDangerousChanges(current, patch);
  if (dangerous.length === 0) return { ok: true };
  if (confirm === true) return { ok: true };
  return {
    ok: false,
    dangerous,
    impacts: dangerous.map((key) => ({ key, text: dangerousImpactText(key) })),
  };
}
