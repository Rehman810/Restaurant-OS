"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Approver = { id: string; name: string; role: string };

export type ManagerApprovalResult = {
  approverId: string;
  approverName: string;
  pin: string;
};

type Props = {
  open: boolean;
  title: string;
  reasonOptions: string[];
  reasonCode: string;
  reasonNote: string;
  onReasonCodeChange: (v: string) => void;
  onReasonNoteChange: (v: string) => void;
  onCancel: () => void;
  onApproved: (result: ManagerApprovalResult) => void;
};

export function ManagerApprovalModal({
  open,
  title,
  reasonOptions,
  reasonCode,
  reasonNote,
  onReasonCodeChange,
  onReasonNoteChange,
  onCancel,
  onApproved,
}: Props) {
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [approverId, setApproverId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPin("");
    setError("");
    void api<{ approvers: Approver[] }>("/admin/approval/approvers").then((d) => {
      setApprovers(d.approvers);
      if (d.approvers[0]) setApproverId(d.approvers[0].id);
    });
  }, [open]);

  if (!open) return null;

  async function submit() {
    if (!reasonCode.trim()) {
      setError("Select a reason.");
      return;
    }
    if (!approverId || pin.length < 4) {
      setError("Enter manager PIN.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api<{ ok: true; approverId: string; approverName: string }>(
        "/admin/approval/verify",
        { method: "POST", body: JSON.stringify({ approverId, pin }) }
      );
      onApproved({ approverId: res.approverId, approverName: res.approverName, pin });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setLoading(false);
    }
  }

  function appendDigit(d: string) {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center" role="presentation">
      <div
        className="w-full max-w-md rounded-3xl border border-stone-200 bg-white p-5 shadow-xl dark:border-stone-600 dark:bg-stone-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mgr-approval-title"
      >
        <h2 id="mgr-approval-title" className="text-lg font-semibold text-stone-900 dark:text-stone-50">
          {title}
        </h2>
        <label className="mt-4 block text-xs font-semibold uppercase text-stone-500">Reason</label>
        <select
          className="input mt-1 w-full"
          value={reasonCode}
          onChange={(e) => onReasonCodeChange(e.target.value)}
        >
          <option value="">Select…</option>
          {reasonOptions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <input
          className="input mt-2 w-full"
          placeholder="Optional note"
          value={reasonNote}
          onChange={(e) => onReasonNoteChange(e.target.value)}
        />
        <label className="mt-4 block text-xs font-semibold uppercase text-stone-500">Manager</label>
        <select className="input mt-1 w-full" value={approverId} onChange={(e) => setApproverId(e.target.value)}>
          {approvers.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <p className="mt-4 text-center font-mono text-2xl tracking-[0.4em] text-stone-800 dark:text-stone-100">
          {pin ? "•".repeat(pin.length) : "····"}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "ok"].map((key) => (
            <button
              key={key}
              type="button"
              className="rounded-2xl border border-stone-200 py-3 text-lg font-semibold dark:border-stone-600"
              onClick={() => {
                if (key === "clear") setPin("");
                else if (key === "ok") void submit();
                else appendDigit(key);
              }}
              disabled={loading}
            >
              {key === "clear" ? "⌫" : key === "ok" ? "✓" : key}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <button type="button" className="btn-ghost mt-4 w-full" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
      </div>
    </div>
  );
}
