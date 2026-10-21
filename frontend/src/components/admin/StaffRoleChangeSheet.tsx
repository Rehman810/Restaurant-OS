"use client";

import { useState } from "react";
import { Role } from "@/lib/types";
import { ConfirmSheet } from "./ConfirmSheet";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  WAITER: "Waiter",
  CHEF: "Chef",
  RIDER: "Rider",
  CASHIER: "Cashier",
  CUSTOMER: "Customer",
};

export function StaffRoleChangeSheet({
  open,
  memberName,
  currentRole,
  options,
  saving,
  onClose,
  onConfirm,
}: {
  open: boolean;
  memberName: string;
  currentRole: Role;
  options: { value: Role; label: string }[];
  saving?: boolean;
  onClose: () => void;
  onConfirm: (role: Role) => void;
}) {
  const [next, setNext] = useState<Role>(currentRole);

  return (
    <ConfirmSheet
      open={open}
      title={`Change role for ${memberName}`}
      message={
        <div className="space-y-3 text-left">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Current role: <strong>{ROLE_LABELS[currentRole]}</strong>. Access to pages and actions updates immediately.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wide text-stone-500">
            New role
            <select
              className="input mt-1 w-full min-h-[44px]"
              value={next}
              onChange={(e) => setNext(e.target.value as Role)}
            >
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      }
      confirmLabel="Change role"
      saving={saving}
      onClose={onClose}
      onConfirm={() => onConfirm(next)}
    />
  );
}
