"use client";

import Link from "next/link";
import { Bell, Check, Minus } from "lucide-react";
import { SettingsSection } from "@/components/admin/SettingsSection";
import type { StoreSettings } from "@/lib/types";
import {
  NOTIFICATION_EMAIL_ROWS,
  NOTIFY_ROLE_COLUMNS,
  notificationMatrixCell,
  type EmailNotifySettingKey,
  type MatrixCellState,
} from "@/modules/settings/notification-matrix";

type Props = {
  settings: StoreSettings;
  onChange: (patch: Partial<StoreSettings>) => void;
};

function CellIcon({ state }: { state: MatrixCellState }) {
  if (state === "on") {
    return <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="On" />;
  }
  if (state === "off") {
    return <span className="mx-auto block h-2 w-2 rounded-full bg-stone-300" aria-label="Off" />;
  }
  if (state === "always") {
    return (
      <span className="mx-auto text-[10px] font-bold uppercase tracking-wide text-stone-500" title="Always sent">
        Auto
      </span>
    );
  }
  return <Minus className="mx-auto h-3.5 w-3.5 text-stone-300" aria-hidden />;
}

export function NotificationsSettings({ settings, onChange }: Props) {
  function toggle(key: EmailNotifySettingKey, next: boolean) {
    onChange({ [key]: next });
  }

  return (
    <SettingsSection
      icon={Bell}
      title="Notifications"
      description="Email toggles per role. The matrix shows which messages each role can receive."
    >
      <p className="text-xs text-stone-600">
        In-app alerts (bell icon) and optional browser push use the live ops feed — not controlled here. Customer
        order-status push is under{" "}
        <Link href="/admin/settings/devices-printing" className="font-semibold text-brand-700 hover:text-brand-800">
          Devices and printing
        </Link>
        .
      </p>

      <div className="overflow-x-auto rounded-2xl border border-stone-200">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2.5 font-semibold text-stone-700">Email event</th>
              {NOTIFY_ROLE_COLUMNS.map((col) => {
                const on = col.settingKey ? Boolean(settings[col.settingKey] ?? true) : false;
                return (
                  <th key={col.id} className="px-2 py-2 text-center font-semibold text-stone-700">
                    <div className="flex flex-col items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.settingKey && (
                        <button
                          type="button"
                          role="switch"
                          aria-checked={on}
                          aria-label={`${col.label} email notifications`}
                          onClick={() => toggle(col.settingKey!, !on)}
                          className={`relative h-6 w-10 shrink-0 rounded-full transition ${
                            on ? "bg-brand-600" : "bg-stone-300"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                              on ? "left-[1.125rem]" : "left-0.5"
                            }`}
                          />
                        </button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EMAIL_ROWS.map((row) => (
              <tr key={row.id} className="border-b border-stone-100 last:border-b-0">
                <td className="sticky left-0 z-10 bg-white px-3 py-2.5">
                  <p className="font-semibold text-stone-900">{row.label}</p>
                  <p className="mt-0.5 max-w-[14rem] text-[11px] leading-snug text-stone-500">{row.description}</p>
                </td>
                {row.transactional ? (
                  <td
                    colSpan={NOTIFY_ROLE_COLUMNS.length}
                    className="px-3 py-2 text-center text-[11px] font-semibold text-stone-600"
                  >
                    Always sent (not affected by toggles above)
                  </td>
                ) : (
                  NOTIFY_ROLE_COLUMNS.map((col) => {
                    const state = notificationMatrixCell(row.id, col.id, settings);
                    return (
                      <td key={col.id} className="px-2 py-2 text-center align-middle">
                        <CellIcon state={state} />
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-stone-500">
        Green check = email sent when that role&apos;s toggle is on. Account emails (reset, staff invite) always go to
        the recipient. SMTP must be configured on the server for any email to send.
      </p>
    </SettingsSection>
  );
}
