"use client";

import { usePathname } from "next/navigation";
import { usePlatformAuth } from "@/lib/auth";
import { PanelRouteGuard } from "@/components/PanelRouteGuard";
import { Shell } from "@/components/Shell";
import { ForbiddenPage } from "@/components/RequirePermission";
import { canAccess, NAV_PERMISSIONS } from "@/lib/permissions";

function permissionForPath(path: string) {
  if (path.startsWith("/tenants")) return NAV_PERMISSIONS["/tenants"];
  const root = `/${path.split("/").filter(Boolean)[0] || ""}`;
  return NAV_PERMISSIONS[root];
}

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = usePlatformAuth();
  const path = usePathname();
  const required = permissionForPath(path);

  if (loading) {
    return (
      <div className="panel-surface grid min-h-screen place-items-center text-slate-300">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-accent-400/30 border-t-accent-400" />
          <p className="mt-3 text-sm text-slate-400">Loading console…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  if (required && !canAccess(user.permissions, required)) {
    return (
      <Shell>
        <ForbiddenPage />
      </Shell>
    );
  }

  return (
    <Shell>
      <PanelRouteGuard>{children}</PanelRouteGuard>
    </Shell>
  );
}
