"use client";

import { useEffect, useState } from "react";
import { adminSidebarInsetLeft, readAdminSidebarCollapsed } from "@/lib/admin-sidebar";

/** Tracks admin sidebar width for fixed footers (settings save bar, etc.). */
export function useAdminSidebarInsetLeft(): string {
  const [left, setLeft] = useState(() => adminSidebarInsetLeft(readAdminSidebarCollapsed()));

  useEffect(() => {
    const sync = () => setLeft(adminSidebarInsetLeft(readAdminSidebarCollapsed()));
    sync();
    window.addEventListener("admin-sidebar-change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("admin-sidebar-change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return left;
}
