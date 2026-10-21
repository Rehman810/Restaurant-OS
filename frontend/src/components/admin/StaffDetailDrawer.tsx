"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { formatWhen } from "@/lib/format";
import type { StaffListRow } from "@/modules/staff/types";
import { staffDisplayName } from "@/modules/staff/helpers";

type SessionRow = { id: string; device: string; ipMasked: string | null; lastSeenAt: string };
type AuditRow = { id: string; action: string; createdAt: string };

export function StaffDetailDrawer({
  member,
  open,
  onClose,
}: {
  member: StaffListRow | null;
  open: boolean;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 300);
  }, [onClose]);

  useEffect(() => {
    if (!open || !member) return;
    setVisible(true);
    document.body.style.overflow = "hidden";
    setLoading(true);
    Promise.all([
      api<{ sessions: SessionRow[] }>(`/admin/staff/${member.id}/sessions`).catch(() => ({ sessions: [] })),
      api<{ entries: AuditRow[] }>(`/admin/staff/${member.id}/audit`).catch(() => ({ entries: [] })),
    ])
      .then(([s, a]) => {
        setSessions(s.sessions);
        setAudit(a.entries);
      })
      .finally(() => setLoading(false));
    return () => {
      document.body.style.overflow = "";
    };
  }, [open, member]);

  if (!open || !member) return null;

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-stone-950/50" onClick={close} />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative flex h-full w-full max-w-md flex-col bg-white shadow-xl transition dark:bg-stone-900 ${
          visible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-start justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
          <div>
            <p className="text-lg font-semibold text-stone-900 dark:text-stone-50">
              {staffDisplayName(member)}
            </p>
            <p className="text-sm text-stone-500">{member.accessSummary}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 dark:border-stone-600"
          >
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recent sign-ins</p>
          {loading ? (
            <div className="mt-2 skeleton h-16 rounded-xl" />
          ) : sessions.length ? (
            <ul className="mt-2 space-y-2">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-xl border border-stone-100 px-3 py-2 dark:border-stone-800">
                  <p className="font-medium text-stone-800 dark:text-stone-100">{s.device}</p>
                  <p className="text-xs text-stone-500">
                    {s.ipMasked ? `${s.ipMasked} · ` : ""}
                    {formatWhen(s.lastSeenAt)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-stone-500">No recent sessions recorded.</p>
          )}

          <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-stone-500">Recent activity</p>
          {audit.length ? (
            <ul className="mt-2 space-y-2">
              {audit.map((e) => (
                <li key={e.id} className="text-xs text-stone-600 dark:text-stone-300">
                  <span className="font-mono text-stone-500">{e.action}</span>
                  <span className="mx-2">·</span>
                  {formatWhen(e.createdAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-stone-500">No audit entries yet.</p>
          )}
        </div>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
