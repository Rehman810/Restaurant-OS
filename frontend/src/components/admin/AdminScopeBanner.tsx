"use client";

import Link from "next/link";
import { Building2, Globe2, Layers } from "lucide-react";
import { useBranch } from "@/modules/branches/BranchContext";

type Variant = "branch" | "chain" | "shared";

export function AdminScopeBanner({ variant }: { variant: Variant }) {
  const { selection, activeBranch, branches } = useBranch();

  if (variant === "chain") {
    return (
      <p
        className="flex items-start gap-2 rounded-lg border border-stone-200/80 bg-stone-50/80 px-3 py-2.5 text-xs leading-relaxed text-stone-600 dark:border-stone-700 dark:bg-stone-800/40 dark:text-stone-400"
        role="status"
      >
        <Globe2 className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" size={15} aria-hidden />
        <span>
          <span className="font-semibold text-stone-800 dark:text-stone-200">Chain-wide.</span> Applies to all branches.
          Outlet-specific contact is under{" "}
          <Link
            href="/admin/branches"
            className="font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
          >
            Branches
          </Link>
          .
        </span>
      </p>
    );
  }

  if (variant === "shared") {
    return (
      <div
        className="flex items-start gap-2.5 rounded-2xl border border-stone-200/80 bg-stone-50/90 px-4 py-3 text-sm text-stone-600 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-300"
        role="status"
      >
        <Layers className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" size={18} />
        <p>
          <span className="font-semibold text-stone-800 dark:text-stone-100">Shared catalog</span>
          {" — "}
          Menu and delivery areas are the same for all branches. Orders and kitchen use the branch selected in the header.
        </p>
      </div>
    );
  }

  const branchLabel =
    selection === "all"
      ? `All branches (${branches.length})`
      : activeBranch?.name ?? "This branch";

  return (
    <div
      className="flex items-center gap-2.5 rounded-2xl border border-brand-200/60 bg-brand-50/80 px-4 py-2.5 text-sm text-brand-900 dark:border-brand-800/50 dark:bg-brand-950/40 dark:text-brand-100"
      role="status"
    >
      {selection === "all" ? (
        <Layers className="shrink-0 text-brand-600 dark:text-brand-400" size={18} />
      ) : (
        <Building2 className="shrink-0 text-brand-600 dark:text-brand-400" size={18} />
      )}
      <p>
        Showing data for <span className="font-bold">{branchLabel}</span>. Switch branch in the header to change scope.
      </p>
    </div>
  );
}
