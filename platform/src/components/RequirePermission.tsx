"use client";

import Link from "next/link";
import { usePlatformAuth } from "@/lib/auth";
import type { PlatformPermission } from "@/lib/permissions";
import { canAccess } from "@/lib/permissions";

export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: PlatformPermission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { user } = usePlatformAuth();
  if (!canAccess(user?.permissions, permission)) {
    return (
      fallback ?? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          You do not have permission for this action ({permission}).
        </p>
      )
    );
  }
  return <>{children}</>;
}

export function ForbiddenPage() {
  return (
    <div className="mx-auto max-w-md space-y-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Access restricted</h1>
      <p className="text-sm text-slate-500">Your platform role cannot open this section.</p>
      <Link href="/overview" className="btn-primary inline-flex">Back to overview</Link>
    </div>
  );
}
