"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePlatformAuth } from "@/lib/auth";
import { canAccessNav } from "@/lib/permissions";
import { ForbiddenPage } from "./RequirePermission";

export function PanelGuard({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading } = usePlatformAuth();

  const section = NAV_SECTION(path);

  useEffect(() => {
    if (loading || !user) return;
    if (section && !canAccessNav(user.permissions, section)) {
      router.replace("/overview");
    }
  }, [loading, user, section, router]);

  if (loading) return null;
  if (section && user && !canAccessNav(user.permissions, section)) {
    return <ForbiddenPage />;
  }

  return <>{children}</>;
}

function NAV_SECTION(path: string): string | null {
  if (path.startsWith("/tenants")) return "/tenants";
  const top = `/${path.split("/").filter(Boolean)[0] || ""}`;
  if (["/overview", "/announcements", "/audit", "/health", "/settings"].includes(top)) return top;
  return null;
}
