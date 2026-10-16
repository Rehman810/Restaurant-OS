"use client";

import {
  Bike,
  Briefcase,
  ChefHat,
  Flame,
  Receipt,
  Shield,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Role } from "@/lib/types";
import { formatWhen } from "@/lib/format";

export type StaffRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  totpEnabled: boolean;
  createdAt: string;
  branchIds?: string[];
};

export type BranchOption = { id: string; name: string };

export const ASSIGNABLE_ROLES: { value: Role; label: string }[] = [
  { value: "MANAGER", label: "Manager" },
  { value: "WAITER", label: "Waiter" },
  { value: "CHEF", label: "Chef" },
  { value: "RIDER", label: "Rider" },
  { value: "CASHIER", label: "Cashier" },
];

const ROLE_STYLES: Record<Role, string> = {
  ADMIN: "bg-violet-50 text-violet-800 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-200 dark:ring-violet-800",
  MANAGER: "bg-indigo-50 text-indigo-800 ring-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-200 dark:ring-indigo-800",
  WAITER: "bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-100 dark:bg-fuchsia-950/50 dark:text-fuchsia-200 dark:ring-fuchsia-800",
  CHEF: "bg-brand-50 text-brand-800 ring-brand-100 dark:bg-brand-950/50 dark:text-brand-200 dark:ring-brand-800",
  RIDER: "bg-sky-50 text-sky-800 ring-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-800",
  CASHIER: "bg-emerald-50 text-emerald-800 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-200 dark:ring-emerald-800",
  CUSTOMER: "bg-stone-50 text-stone-600 ring-stone-100",
};

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

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-brand-500 to-brand-700",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
];

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function avatarGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[hash];
}

function branchLabels(branchIds: string[], branches: BranchOption[]) {
  const names = branchIds
    .map((id) => branches.find((b) => b.id === id)?.name)
    .filter(Boolean) as string[];
  return names.length ? names.join(", ") : "—";
}

function RoleTag({ role }: { role: Role }) {
  const Icon = ROLE_ICONS[role];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${ROLE_STYLES[role]}`}
    >
      {Icon ? <Icon size={12} /> : null}
      {ROLE_LABEL[role]}
    </span>
  );
}

export function StaffTable({
  staff,
  branches,
  currentUserId,
  busyId,
  onToggleActive,
}: {
  staff: StaffRow[];
  branches: BranchOption[];
  currentUserId?: string;
  busyId: string | null;
  onToggleActive: (member: StaffRow) => void;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1080px] table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[16%]" />
            <col className="w-[14%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50/80 text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:border-stone-800 dark:bg-stone-800/50">
              <th className="px-4 py-3 font-semibold">Staff member</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Branches</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">2FA</th>
              <th className="px-4 py-3 font-semibold">Joined</th>
              <th className="px-4 py-3 font-semibold">Access</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const isSelf = s.id === currentUserId;
              const isAdmin = s.role === "ADMIN";

              return (
                <tr
                  key={s.id}
                  className={`border-b border-stone-100 last:border-0 transition hover:bg-brand-50/30 dark:border-stone-800 dark:hover:bg-stone-800/40 ${
                    !s.isActive ? "opacity-75" : ""
                  }`}
                >
                  <td className="px-4 py-3.5 align-top">
                    <div className="flex items-center gap-3">
                      <div
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-white ${avatarGradient(s.id)}`}
                      >
                        {initials(s.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-stone-900 dark:text-stone-100">{s.name}</p>
                          {isSelf && (
                            <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                              You
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <p className="truncate text-xs text-stone-600 dark:text-stone-300">{s.email}</p>
                    {s.phone ? (
                      <p className="mt-0.5 text-xs text-stone-500">{s.phone}</p>
                    ) : (
                      <p className="mt-0.5 text-xs text-stone-400">No phone</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <p className="text-xs leading-relaxed text-stone-600 dark:text-stone-300">
                      {isAdmin ? "All outlets" : branchLabels(s.branchIds ?? [], branches)}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <RoleTag role={s.role} />
                  </td>
                  <td className="px-4 py-3.5 align-top">
                    <button
                      type="button"
                      disabled={busyId === s.id || (isSelf && s.isActive)}
                      onClick={() => onToggleActive(s)}
                      className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                        s.isActive
                          ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100 hover:bg-emerald-100"
                          : "bg-stone-100 text-stone-600 ring-1 ring-stone-200 hover:bg-stone-200"
                      }`}
                    >
                      {s.isActive ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top">
                    {isAdmin ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          s.totpEnabled ? "text-emerald-700" : "text-stone-400"
                        }`}
                      >
                        {s.totpEnabled ? <ShieldCheck size={13} /> : <Shield size={13} />}
                        {s.totpEnabled ? "On" : "Off"}
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 align-top text-xs text-stone-500">
                    {formatWhen(s.createdAt)}
                  </td>
                  <td className="px-4 py-3.5 align-top text-xs text-stone-500 dark:text-stone-400">
                    {isAdmin && "Owner · role locked"}
                    {s.role === "MANAGER" && "Branch operations · no system settings"}
                    {s.role === "WAITER" && "Floor · dine-in tables & POS"}
                    {s.role === "CHEF" && (
                      <span className="inline-flex items-center gap-1">
                        <Flame size={12} className="text-brand-500" /> Kitchen
                      </span>
                    )}
                    {s.role === "RIDER" && "Rider app · deliveries"}
                    {s.role === "CASHIER" && "POS · counter orders"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
