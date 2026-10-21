"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import type { AdminBranch, DeactivationCheck } from "@/modules/branches/types";
import { fetchDeactivationCheck } from "@/modules/branches/api";

export function DeactivateBranchSheet({
  branch,
  otherBranches,
  open,
  saving,
  onClose,
  onConfirm,
}: {
  branch: AdminBranch | null;
  otherBranches: AdminBranch[];
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onConfirm: (opts: { staffAction?: "reassign" | "revoke"; targetBranchId?: string }) => void;
}) {
  const [check, setCheck] = useState<DeactivationCheck | null>(null);
  const [loading, setLoading] = useState(false);
  const [staffAction, setStaffAction] = useState<"reassign" | "revoke">("reassign");
  const [targetBranchId, setTargetBranchId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || !branch) return;
    setLoading(true);
    void fetchDeactivationCheck(branch.id)
      .then(setCheck)
      .catch(() => setCheck(null))
      .finally(() => setLoading(false));
  }, [open, branch?.id]);

  useEffect(() => {
    if (!open) {
      setConfirmOpen(false);
      setStaffAction("reassign");
      setTargetBranchId(otherBranches[0]?.id || "");
    }
  }, [open, otherBranches]);

  if (!branch) return null;

  const needsStaff = (check?.staffAssigned ?? 0) > 0;
  const blocked = check && !check.canDeactivate;

  return (
    <>
      <ConfirmSheet
        open={open && !confirmOpen}
        title={`Deactivate ${branch.name}?`}
        message={
          <div className="space-y-3 text-sm text-stone-600 dark:text-stone-300">
            {loading && <p>Checking blockers…</p>}
            {check && blocked && (
              <ul className="space-y-2">
                {check.blockers.map((b) => (
                  <li key={b.code} className="flex justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/30">
                    <Link href={b.href} className="font-medium text-red-800 underline-offset-2 hover:underline dark:text-red-200">
                      {b.label}
                    </Link>
                    <span className="tabular-nums text-red-700 dark:text-red-300">{b.count}</span>
                  </li>
                ))}
              </ul>
            )}
            {check && !blocked && needsStaff && (
              <div className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                <p className="text-xs text-stone-500">{check.staffNote}</p>
                <p className="font-medium">{check.staffAssigned} staff assigned</p>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={staffAction === "reassign"} onChange={() => setStaffAction("reassign")} />
                  Reassign to another branch
                </label>
                {staffAction === "reassign" && (
                  <select className="input" value={targetBranchId} onChange={(e) => setTargetBranchId(e.target.value)}>
                    {otherBranches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" checked={staffAction === "revoke"} onChange={() => setStaffAction("revoke")} />
                  Remove branch access (they lose access to this branch)
                </label>
              </div>
            )}
            {check && !blocked && !needsStaff && (
              <p>New orders and bookings will stop for this branch. History stays in reports.</p>
            )}
          </div>
        }
        confirmLabel={blocked ? "Close" : "Continue"}
        danger={!blocked}
        saving={loading}
        onClose={onClose}
        onConfirm={() => {
          if (blocked) {
            onClose();
            return;
          }
          if (needsStaff && staffAction === "reassign" && !targetBranchId) return;
          setConfirmOpen(true);
        }}
      />

      <ConfirmSheet
        open={confirmOpen}
        title="Confirm deactivation"
        message={`Deactivate ${branch.name}? This cannot be undone without reactivating the branch.`}
        confirmLabel="Deactivate branch"
        danger
        saving={saving}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() =>
          onConfirm(
            needsStaff
              ? staffAction === "reassign"
                ? { staffAction, targetBranchId }
                : { staffAction: "revoke" }
              : {}
          )
        }
      />
    </>
  );
}
