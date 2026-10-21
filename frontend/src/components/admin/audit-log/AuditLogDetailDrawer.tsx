"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AuditLogRow, formatAuditWhenFull } from "@/lib/audit-log";

const CLOSE_MS = 320;

function formatJson(v: unknown) {
  if (v == null) return "—";
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function AuditLogDetailDrawer({
  row,
  timezone,
  timezoneLabel,
  isAdmin,
  onClose,
}: {
  row: AuditLogRow | null;
  timezone: string;
  timezoneLabel: string;
  isAdmin: boolean;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!row) return;
    setClosing(false);
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [row, close]);

  if (!row) return null;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(row!.entityId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${
        visible && !closing ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      role="presentation"
      onClick={close}
    >
      <div
        className={`h-full w-full max-w-lg overflow-y-auto border-l border-stone-200 bg-white shadow-2xl transition-transform duration-300 dark:border-stone-700 dark:bg-stone-900 ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-stone-100 bg-white/95 px-5 py-4 backdrop-blur dark:border-stone-800 dark:bg-stone-900/95">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
              {row.category}
            </p>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-50">{row.actionLabel}</h2>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">{row.summary}</p>
          </div>
          <button type="button" className="btn-ghost rounded-full p-2" onClick={close} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <dl className="grid gap-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Time</dt>
              <dd className="text-stone-800 dark:text-stone-200" title={formatAuditWhenFull(row.createdAt, timezone)}>
                {formatAuditWhenFull(row.createdAt, timezone)} ({timezoneLabel})
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Actor</dt>
              <dd>
                {row.actor.name}
                {row.actor.role && (
                  <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                    {row.actor.role}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Branch</dt>
              <dd>{row.branch?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-stone-500">Entity</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{row.entityLabel}</span>
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600 dark:bg-stone-800 dark:text-stone-400">
                  {row.entityType}
                </span>
                <button type="button" className="text-xs font-semibold text-brand-700 dark:text-brand-400" onClick={copyId}>
                  {copied ? "Copied ID" : "Copy ID"}
                </button>
              </dd>
            </div>
            {row.reason && (
              <div>
                <dt className="text-xs font-semibold uppercase text-stone-500">Reason</dt>
                <dd>{row.reason}</dd>
              </div>
            )}
          </dl>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-stone-500">Before</p>
              <pre className="mt-1 max-h-52 overflow-auto rounded-xl bg-stone-50 p-3 text-xs dark:bg-stone-800">
                {formatJson(row.before ?? row.meta)}
              </pre>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-stone-500">After</p>
              <pre className="mt-1 max-h-52 overflow-auto rounded-xl bg-stone-50 p-3 text-xs dark:bg-stone-800">
                {formatJson(row.after ?? row.meta)}
              </pre>
            </div>
          </div>

          {isAdmin && (row.ip || row.userAgent) && (
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 p-3 text-xs text-stone-600 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-400">
              <p className="font-semibold text-stone-800 dark:text-stone-200">Admin diagnostics</p>
              {row.ip && <p className="mt-1">IP: {row.ip}</p>}
              {row.userAgent && <p className="mt-1 break-all">User agent: {row.userAgent}</p>}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
