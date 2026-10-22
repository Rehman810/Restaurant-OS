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
  const { loading, user, can } = usePlatformAuth();
  const path = usePathname();
  const required = permissionForPath(path);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-slate-300">
        Loading…
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
