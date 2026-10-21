export const ADMIN_SIDEBAR_COLLAPSED_KEY = "uff-admin-sidebar-collapsed";

export const ADMIN_SIDEBAR_WIDTH_EXPANDED = "18rem";
export const ADMIN_SIDEBAR_WIDTH_COLLAPSED = "4.75rem";

export function readAdminSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === "1";
}

export function adminSidebarInsetLeft(collapsed: boolean): string {
  return collapsed ? ADMIN_SIDEBAR_WIDTH_COLLAPSED : ADMIN_SIDEBAR_WIDTH_EXPANDED;
}
