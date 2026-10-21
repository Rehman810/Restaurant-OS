"use client";

import {
  Bike,
  Briefcase,
  ChefHat,
  CircleOff,
  Receipt,
  Shield,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { Role, User } from "@/lib/types";
import { formatWhen } from "@/lib/format";
import type { StaffListRow } from "@/modules/staff/types";
import {
  avatarClassForRole,
  lastActiveLabel,
  staffDisplayName,
  twoFaStatusLabel,
} from "@/modules/staff/helpers";
import { StaffActionsMenu, type StaffAction } from "./StaffActionsMenu";

export type StaffRow = StaffListRow;
export type BranchOption = { id: string; name: string };

export const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "WAITER", label: "Waiter" },
  { value: "CHEF", label: "Chef" },
  { value: "RIDER", label: "Rider" },
  { value: "CASHIER", label: "Cashier" },
];

const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  WAITER: "Waiter",
  CHEF: "Chef",
  RIDER: "Rider",
  CASHIER: "Cashier",
  CUSTOMER: "Customer",
};

const ROLE_ICONS: Partial<Record<Role, typeof Shield>> = {
  ADMIN: Shield,
  MANAGER: Briefcase,
  WAITER: UserRound,
  CHEF: ChefHat,
  RIDER: Bike,
  CASHIER: Receipt,
};

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function branchLabels(branchIds: string[], branches: BranchOption[]) {
  const names = branchIds
    .map((id) => branches.find((b) => b.id === id)?.name)
    .filter(Boolean) as string[];
  return names.length ? names.join(", ") : "—";
}

function PillChip({
  children,
  icon,
  className = "bg-stone-100 text-stone-800 ring-stone-200 dark:bg-stone-800 dark:text-stone-100 dark:ring-stone-600",
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${className}`}
    >
      {icon}
      {children}
    </span>
  );
}

export function StaffTable({
  staff,
  branches,
  currentUser,
  busyId,
  dimmed,
  selectedIds,
  onSelectToggle,
  onRowClick,
  onAction,
}: {
  staff: StaffListRow[];
  branches: BranchOption[];
  currentUser: User | null;
  busyId: string | null;
  dimmed?: boolean;
  selectedIds?: Set<string>;
  onSelectToggle?: (id: string) => void;
  onRowClick: (member: StaffListRow) => void;
  onAction: (member: StaffListRow, action: StaffAction) => void;
}) {
  const showBulk = currentUser?.role === "ADMIN" && onSelectToggle;

  return (
    <>
      <div className={`hidden w-full md:block ${dimmed ? "opacity-60" : ""}`}>
        <div className="w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1100px] table-fixed border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-100 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:border-stone-800 dark:bg-stone-900/80">
                {showBulk && <th className="w-12 px-2 py-3" />}
                <th className="px-4 py-3 font-semibold">Staff member</th>
                <th className="px-4 py-3 font-semibold">Contact</th>
                <th className="hidden px-4 py-3 font-semibold xl:table-cell">Branches</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">2FA</th>
                <th className="px-4 py-3 font-semibold">Last active</th>
                <th className="hidden px-4 py-3 font-semibold lg:table-cell">Joined</th>
                <th className="hidden px-4 py-3 font-semibold 2xl:table-cell">Access</th>
                <th className="w-14 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const isSelf = s.id === currentUser?.id;
                const isAdmin = s.role === "ADMIN";
                const display = staffDisplayName(s);
                const RoleIcon = ROLE_ICONS[s.role];
                const twoFa = twoFaStatusLabel(s);
                const statusChip = s.isActive
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-800/50"
                  : "bg-stone-100 text-stone-600 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600";
                const statusIcon = s.isActive ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                ) : (
                  <CircleOff size={12} className="text-stone-500" aria-hidden />
                );
                const twoFaChip = twoFa.warn
                  ? "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/50"
                  : s.totpEnabled
                    ? "bg-sky-50 text-sky-800 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:ring-sky-800/50"
                    : "bg-stone-100 text-stone-700 ring-stone-200 dark:bg-stone-800 dark:text-stone-300 dark:ring-stone-600";

                return (
                  <tr
                    key={s.id}
                    className={`border-b border-stone-100 last:border-0 hover:bg-stone-50/80 dark:border-stone-800 dark:hover:bg-stone-800/40 ${
                      !s.isActive ? "opacity-80" : ""
                    }`}
                  >
                    {showBulk && (
                      <td className="px-2 py-3 align-middle">
                        <div className="flex h-full items-center justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-stone-300 text-brand-600"
                            checked={selectedIds?.has(s.id)}
                            onChange={() => onSelectToggle?.(s.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${display}`}
                          />
                        </div>
                      </td>
                    )}
                    <td className="cursor-pointer px-4 py-3 align-middle" onClick={() => onRowClick(s)}>
                      <div className="flex items-center gap-3">
                        <div
                          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold ${avatarClassForRole(s.role)}`}
                        >
                          {initials(display)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-semibold text-stone-900 dark:text-stone-100">{display}</p>
                            {isSelf && <PillChip>You</PillChip>}
                            {s.isTest && <PillChip>Test</PillChip>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <p className="truncate text-xs text-stone-600 dark:text-stone-300" title={s.email}>
                        {s.email}
                      </p>
                      {s.phone ? <p className="mt-0.5 text-xs text-stone-500">{s.phone}</p> : null}
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-xs text-stone-600 dark:text-stone-300 xl:table-cell">
                      {isAdmin ? "All outlets" : branchLabels(s.branchIds ?? [], branches)}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <PillChip
                        className="bg-violet-50 text-violet-900 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-100 dark:ring-violet-800/50"
                        icon={RoleIcon ? <RoleIcon size={12} /> : null}
                      >
                        {ROLE_LABEL[s.role]}
                      </PillChip>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <PillChip className={statusChip} icon={statusIcon}>
                        {s.isActive ? "Active" : "Inactive"}
                      </PillChip>
                    </td>
                    <td className="hidden px-4 py-3 align-middle lg:table-cell">
                      <PillChip
                        className={twoFaChip}
                        icon={
                          twoFa.warn ? (
                            <ShieldAlert size={12} aria-hidden />
                          ) : (
                            <Shield size={12} aria-hidden />
                          )
                        }
                      >
                        {twoFa.text}
                      </PillChip>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-stone-600 dark:text-stone-400">
                      {lastActiveLabel(s.lastActiveAt)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 align-middle text-xs text-stone-500 lg:table-cell">
                      {formatWhen(s.createdAt)}
                    </td>
                    <td className="hidden px-4 py-3 align-middle text-xs text-stone-600 dark:text-stone-300 2xl:table-cell">
                      {s.accessSummary ?? "—"}
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex justify-end">
                      <StaffActionsMenu
                        member={s}
                        actor={currentUser}
                        disabled={busyId === s.id}
                        onAction={(action) => onAction(s, action)}
                      />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        </div>
      </div>

      <ul className={`space-y-3 md:hidden ${dimmed ? "opacity-60" : ""}`}>
        {staff.map((s) => {
          const display = staffDisplayName(s);
          const twoFa = twoFaStatusLabel(s);
          return (
            <li
              key={s.id}
              className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-stone-700 dark:bg-stone-900"
            >
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onRowClick(s)}>
                  <p className="font-semibold text-stone-900 dark:text-stone-50">{display}</p>
                  <p className="mt-1 text-xs text-stone-500">{ROLE_LABEL[s.role]} · {s.isActive ? "Active" : "Inactive"}</p>
                  <p className="mt-1 text-xs text-stone-500">{lastActiveLabel(s.lastActiveAt)}</p>
                  {twoFa.warn && (
                    <p className="mt-1 text-xs font-semibold text-stone-700 dark:text-stone-200">2FA required</p>
                  )}
                </button>
                <StaffActionsMenu
                  member={s}
                  actor={currentUser}
                  disabled={busyId === s.id}
                  onAction={(action) => onAction(s, action)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
