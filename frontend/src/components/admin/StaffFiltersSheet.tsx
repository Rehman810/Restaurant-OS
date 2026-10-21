"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { SelectField, SearchField } from "@/components/admin/ui";
import { User } from "@/lib/types";

export function StaffFiltersSheetTrigger({
  onClick,
  activeCount,
}: {
  onClick: () => void;
  activeCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-800 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 md:hidden"
    >
      <SlidersHorizontal size={18} />
      Filters{activeCount > 0 ? ` (${activeCount})` : ""}
    </button>
  );
}

export function StaffFiltersSheet({
  open,
  onClose,
  searchInput,
  onSearchInput,
  children,
}: {
  open: boolean;
  onClose: () => void;
  searchInput: string;
  onSearchInput: (v: string) => void;
  children: React.ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  const close = useCallback(() => {
    setVisible(false);
    window.setTimeout(onClose, 280);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setVisible(true);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const sheet = (
    <div className="fixed inset-0 z-[90] md:hidden">
      <button type="button" className="absolute inset-0 bg-stone-950/50" aria-label="Close filters" onClick={close} />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-xl transition dark:bg-stone-900 ${
          visible ? "translate-y-0" : "translate-y-full"
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Staff filters"
      >
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3 dark:border-stone-800">
          <p className="font-semibold text-stone-900 dark:text-stone-50">Filters</p>
          <button
            type="button"
            onClick={close}
            className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 dark:border-stone-600"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="sticky top-0 z-10 border-b border-stone-100 bg-white px-4 py-3 dark:border-stone-800 dark:bg-stone-900">
          <SearchField value={searchInput} onChange={onSearchInput} placeholder="Search staff…" />
        </div>
        <div className="space-y-3 overflow-y-auto px-4 py-4">{children}</div>
        <div className="border-t border-stone-100 p-4 dark:border-stone-800">
          <button type="button" className="btn-primary min-h-[44px] w-full" onClick={close}>
            Show results
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}

export function StaffMobileFilterFields({
  user,
  filters,
  branchOptions,
  onRole,
  onBranch,
  onStatus,
  onTwoFa,
  onLastActive,
}: {
  user: User | null;
  filters: {
    role?: string[];
    branchId?: string;
    status?: string[];
    twoFa?: string;
    lastActive?: string;
  };
  branchOptions: { id: string; name: string }[];
  onRole: (v: string) => void;
  onBranch: (v: string) => void;
  onStatus: (v: string) => void;
  onTwoFa: (v: string) => void;
  onLastActive: (v: string) => void;
}) {
  return (
    <>
      <SelectField
        label="Role"
        value={filters.role?.[0] ?? ""}
        onChange={onRole}
        options={[
          { value: "", label: "All roles" },
          ...["ADMIN", "MANAGER", "CASHIER", "CHEF", "RIDER", "WAITER"].map((r) => ({ value: r, label: r })),
        ]}
      />
      {user?.role === "ADMIN" && (
        <SelectField
          label="Branch"
          value={filters.branchId ?? ""}
          onChange={onBranch}
          options={[
            { value: "", label: "All branches" },
            ...branchOptions.map((b) => ({ value: b.id, label: b.name })),
          ]}
        />
      )}
      <SelectField
        label="Status"
        value={filters.status?.[0] ?? ""}
        onChange={onStatus}
        options={[
          { value: "", label: "Any status" },
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ]}
      />
      <SelectField
        label="2FA"
        value={filters.twoFa ?? ""}
        onChange={onTwoFa}
        options={[
          { value: "", label: "Any" },
          { value: "on", label: "On" },
          { value: "off", label: "Off" },
        ]}
      />
      <SelectField
        label="Last active"
        value={filters.lastActive ?? ""}
        onChange={onLastActive}
        options={[
          { value: "", label: "Any time" },
          { value: "7", label: "Last 7 days" },
          { value: "30", label: "Last 30 days" },
          { value: "90", label: "Last 90 days" },
          { value: "never", label: "Never logged in" },
        ]}
      />
    </>
  );
}
