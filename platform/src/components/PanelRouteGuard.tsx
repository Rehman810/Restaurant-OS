"use client";

import { usePathname } from "next/navigation";
import { usePlatformAuth } from "@/lib/auth";
import { canAccessNav } from "@/lib/permissions";
import { ForbiddenPage } from "./RequirePermission";

export function PanelRouteGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user, loading } = usePlatformAuth();

  if (loading || !user) return null;

  const section = ["/overview", "/tenants", "/announcements", "/audit", "/health", "/settings"].find(
    (base) => path === base || path.startsWith(`${base}/`)
  );

  if (section && !canAccessNav(user.permissions, section)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}
