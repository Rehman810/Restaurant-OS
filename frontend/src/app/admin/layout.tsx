"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, PanelLeft, PanelLeftClose } from "lucide-react";
import { PoweredBy } from "@/components/PoweredBy";
import { StoreLogo } from "@/components/StoreLogo";
import { AdminThemeToggle } from "@/components/admin/AdminThemeToggle";
import { BranchSwitcher } from "@/components/admin/BranchSwitcher";
import { MOBILE_NAV_FOR_ROLE, navSectionsForRole } from "@/modules/admin/navigation";
import { isAdminNavActive } from "@/modules/admin/nav-active";
import { fetchPendingBookingsCount } from "@/modules/dine-in/api";
import { BranchProvider } from "@/modules/branches/BranchContext";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useAdminTheme } from "@/hooks/useAdminTheme";
import { PRODUCT_NAME, storeDisplayName } from "@/lib/branding";
import { useStore } from "@/lib/store";
import { PublicStore } from "@/lib/types";
import { OpsKitchenAlertBanner } from "@/components/admin/OpsKitchenAlertBanner";
import { StaffNotificationCenter } from "@/components/admin/StaffNotificationCenter";
import { ApiUpgradeBanner } from "@/components/admin/ApiUpgradeBanner";
import { chefAdminPathAllowed } from "@/lib/kitchen/chef-access";
import { readKitchenKiosk } from "@/lib/kitchen/display";
import { readPosFullscreen } from "@/lib/pos/display";
import { readTrackingTv } from "@/lib/tracking/display";
import { fetchTrackingSummary } from "@/lib/admin-orders/tracking";
import { unlockKitchenAudio } from "@/lib/kitchen-chime";

const SIDEBAR_KEY = "uff-admin-sidebar-collapsed";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const store = useStore();
  const storeName = storeDisplayName(store?.settings);
  const router = useRouter();
  const path = usePathname();
  const [kitchenOpen, setKitchenOpen] = useState<boolean | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [pendingDineIn, setPendingDineIn] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [syncConflictCount, setSyncConflictCount] = useState(0);
  const [kitchenKiosk, setKitchenKiosk] = useState(false);
  const [posFullscreen, setPosFullscreen] = useState(false);
  const [trackingTv, setTrackingTv] = useState(false);
  const [trackingBadge, setTrackingBadge] = useState(0);
  const { theme, toggle: toggleTheme } = useAdminTheme();

  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === "1");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/store-sw.js", { scope: "/" }).catch(() => null);
    const unlock = () => void unlockKitchenAudio();
    document.addEventListener("pointerdown", unlock, { once: true });
    return () => document.removeEventListener("pointerdown", unlock);
  }, []);

  useEffect(() => {
    const syncKiosk = () => setKitchenKiosk(readKitchenKiosk());
    const syncPosFs = () => setPosFullscreen(readPosFullscreen());
    const syncTrackingTv = () => setTrackingTv(readTrackingTv());
    syncKiosk();
    syncPosFs();
    syncTrackingTv();
    window.addEventListener("kitchen-kiosk-change", syncKiosk);
    window.addEventListener("pos-fullscreen-change", syncPosFs);
    window.addEventListener("tracking-tv-change", syncTrackingTv);
    const onFs = () => {
      if (!document.fullscreenElement) {
        syncKiosk();
      }
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("kitchen-kiosk-change", syncKiosk);
      window.removeEventListener("pos-fullscreen-change", syncPosFs);
      window.removeEventListener("tracking-tv-change", syncTrackingTv);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, []);

  useEffect(() => {
    if (!user || user.role === "CHEF" || user.role === "RIDER") {
      setTrackingBadge(0);
      return;
    }
    const refresh = () => {
      void fetchTrackingSummary()
        .then((r) => setTrackingBadge(r.badge ?? 0))
        .catch(() => setTrackingBadge(0));
    };
    refresh();
    const id = window.setInterval(refresh, 45_000);
    return () => window.clearInterval(id);
  }, [user, path]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  }

  useEffect(() => {
    function load() {
      api<PublicStore>("/settings/public")
        .then((data) => setKitchenOpen(data.isOpen))
        .catch(() => setKitchenOpen(null));
    }
    load();
    window.addEventListener("store-refresh", load);
    return () => window.removeEventListener("store-refresh", load);
  }, [path]);

  useEffect(() => {
    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) return;
    const refresh = () => {
      void fetchPendingBookingsCount()
        .then((r) => setPendingDineIn(r.count))
        .catch(() => setPendingDineIn(0));
    };
    refresh();
    const onPending = (e: Event) => {
      const n = (e as CustomEvent<number>).detail;
      if (typeof n === "number") setPendingDineIn(n);
    };
    window.addEventListener("dine-in-pending", onPending);
    const onNotify = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (kind === "reservation_pending") refresh();
    };
    window.addEventListener("staff-notification", onNotify);
    const id = window.setInterval(refresh, 45_000);
    return () => {
      window.removeEventListener("dine-in-pending", onPending);
      window.removeEventListener("staff-notification", onNotify);
      window.clearInterval(id);
    };
  }, [user, path]);

  useEffect(() => {
    if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) return;
    const refresh = () => {
      void api<{ lowStockCount: number }>("/admin/inventory/alerts")
        .then((r) => setLowStockCount(r.lowStockCount))
        .catch(() => setLowStockCount(0));
    };
    refresh();
    const onNotify = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (
        kind === "inventory_low_stock" ||
        kind === "inventory_out_of_stock" ||
        kind === "inventory_restocked" ||
        kind === "menu_sold_out" ||
        kind === "menu_back_in_stock"
      ) {
        refresh();
      }
    };
    window.addEventListener("staff-notification", onNotify);
    const id = window.setInterval(refresh, 60_000);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("staff-notification", onNotify);
    };
  }, [user, path]);

  useEffect(() => {
    if (!user || store?.settings.offlinePosEnabled === false) {
      setSyncConflictCount(0);
      return;
    }
    if (user.role !== "ADMIN" && user.role !== "MANAGER") return;
    const refresh = () => {
      void api<{ orders: unknown[] }>("/pos/sync-conflicts")
        .then((r) => setSyncConflictCount(r.orders?.length ?? 0))
        .catch(() => setSyncConflictCount(0));
    };
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [user, store?.settings.offlinePosEnabled]);

  const isStaffLogin = path === "/admin/login";

  useEffect(() => {
    if (loading || isStaffLogin) return;
    if (!user) {
      router.replace("/admin/login?next=/admin");
      return;
    }
    if (user.role === "CHEF") {
      if (!chefAdminPathAllowed(path)) router.replace("/admin/kitchen");
      return;
    }
    if (user.role === "CASHIER") {
      const allowedPath = [
        "/admin",
        "/admin/pos",
        "/admin/kitchen",
        "/admin/orders",
        "/admin/tracking",
        "/admin/customers",
      ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      if (!allowedPath) router.replace("/admin/pos");
      return;
    }
    if (user.role === "WAITER") {
      const allowedPath = ["/admin/dine-in", "/admin/pos", "/admin/kitchen"].some(
        (prefix) => path === prefix || path.startsWith(`${prefix}/`)
      );
      if (!allowedPath) router.replace("/admin/dine-in");
      return;
    }
    if (user.role === "MANAGER") {
      const allowedPath = [
        "/admin",
        "/admin/analytics",
        "/admin/reports",
        "/admin/daily-summary",
        "/admin/inventory",
        "/admin/sync-conflicts",
        "/admin/shifts",
        "/admin/kitchen",
        "/admin/pos",
        "/admin/orders",
        "/admin/tracking",
        "/admin/catalog",
        "/admin/menu",
        "/admin/areas",
        "/admin/customers",
        "/admin/riders",
        "/admin/dine-in",
        "/admin/riders/cash",
        "/admin/kitchen/stations",
      ].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
      if (!allowedPath) router.replace("/admin");
      return;
    }
    if (user.role !== "ADMIN") {
      router.replace("/login?next=/admin");
    }
  }, [user, loading, router, path, isStaffLogin]);

  if (isStaffLogin) {
    return (
      <div data-admin-theme={theme} className="relative min-h-screen">
        <div className="pointer-events-none fixed right-4 top-4 z-50 sm:right-6">
          <div className="pointer-events-auto">
            <AdminThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
        {children}
      </div>
    );
  }

  const allowed =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "WAITER" ||
    user?.role === "CHEF" ||
    user?.role === "CASHIER";

  if (loading || !user || !allowed) {
    return (
      <div
        data-admin-theme={theme}
        className="grid min-h-screen place-items-center bg-[#fffaf5] text-stone-400 dark:bg-stone-950 dark:text-stone-500"
      >
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 animate-ping rounded-full bg-brand-500" />
          Opening staff dashboard…
        </div>
      </div>
    );
  }

  const sidebarSections = navSectionsForRole(user.role, {
    offlinePosEnabled: store?.settings.offlinePosEnabled === true,
  });
  const allSidebarHrefs = sidebarSections.flatMap((section) => section.items.map((item) => item.href));
  const mobileNav = MOBILE_NAV_FOR_ROLE[user.role];
  const isPos = path.startsWith("/admin/pos");
  const isKitchen = path.startsWith("/admin/kitchen");
  const isDashboard = path === "/admin";
  const isTracking = path.startsWith("/admin/tracking");
  const hideChrome =
    (isKitchen && kitchenKiosk) || (isPos && posFullscreen) || (isTracking && trackingTv);
  const storeTimezone = store?.settings.timezone ?? "Asia/Karachi";

  return (
    <BranchProvider>
    <div
      data-admin-theme={theme}
      className="min-h-screen bg-[#fffaf5] dark:bg-stone-950 lg:flex"
    >
      <aside
        className={`${hideChrome ? "hidden" : isPos ? "hidden lg:flex" : ""} ${hideChrome && isPos ? "!hidden" : ""} lg:fixed lg:inset-y-0 lg:z-30 lg:flex-col lg:transition-[width] lg:duration-300 ${
          collapsed ? "lg:w-[4.75rem]" : "lg:w-72"
        }`}
      >
        <div className="flex h-full flex-col border-b border-orange-100/80 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900 lg:border-b-0 lg:border-r">
          <div className={`flex items-center gap-3 py-4 ${collapsed ? "lg:justify-center lg:px-2" : "px-4"}`}>
            <StoreLogo
              logoUrl={store?.settings.logoUrl}
              size="md"
              fallbackClassName="bg-gradient-to-br from-brand-500 to-orange-600 text-white shadow-md shadow-brand-500/20"
            />
            <div className={collapsed ? "lg:hidden" : ""}>
              <p className="font-display text-lg leading-tight text-stone-900 dark:text-stone-100">{storeName || PRODUCT_NAME}</p>
              <p className="text-[10px] font-medium uppercase tracking-widest text-stone-400 dark:text-stone-500">{PRODUCT_NAME}</p>
            </div>
          </div>

          <nav className={`relative flex gap-1 overflow-x-auto py-2 lg:flex-1 lg:flex-col lg:gap-0 lg:overflow-y-auto ${collapsed ? "px-2 lg:px-2" : "px-3"}`}>
            {sidebarSections.map((section, sectionIdx) => (
              <div
                key={section.title}
                className={`flex shrink-0 gap-1 lg:mb-3 lg:w-full lg:flex-col lg:last:mb-0 ${
                  sectionIdx > 0 ? "lg:border-t lg:border-orange-100/80 lg:pt-3 dark:lg:border-stone-700" : ""
                }`}
              >
                <p
                  className={`mb-1.5 hidden px-3 text-[10px] font-bold uppercase tracking-widest text-stone-400 lg:block ${
                    collapsed ? "lg:hidden" : ""
                  }`}
                >
                  {section.title}
                </p>
                {section.items.map((n) => {
                  const active = isAdminNavActive(path, n.href, allSidebarHrefs);
                  const Icon = n.icon;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      title={n.label}
                      className={`relative flex shrink-0 items-center rounded-xl text-sm font-semibold transition ${
                        collapsed ? "lg:justify-center lg:px-0 lg:py-3" : "gap-2.5 px-3 py-2.5"
                      } ${
                        active
                          ? "bg-brand-50 text-brand-800 ring-1 ring-brand-100 dark:bg-brand-950/50 dark:text-brand-200 dark:ring-brand-800"
                          : "text-stone-500 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100"
                      }`}
                    >
                      <Icon size={18} className={active ? "text-brand-600" : ""} />
                      <span className={collapsed ? "lg:hidden" : ""}>{n.label}</span>
                      {n.href === "/admin/inventory" && lowStockCount > 0 && (
                        <Link
                          href="/admin/inventory?stock=low"
                          title={`${lowStockCount} low stock item${lowStockCount === 1 ? "" : "s"}`}
                          className={`ml-auto grid min-w-[1.25rem] place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-rose-600 ${
                            collapsed ? "lg:absolute lg:right-1 lg:top-1 lg:ml-0" : ""
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lowStockCount > 99 ? "99+" : lowStockCount}
                        </Link>
                      )}
                      {n.href === "/admin/sync-conflicts" && syncConflictCount > 0 && (
                        <span
                          className={`ml-auto grid min-w-[1.25rem] place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white ${
                            collapsed ? "lg:absolute lg:right-1 lg:top-1 lg:ml-0" : ""
                          }`}
                        >
                          {syncConflictCount > 99 ? "99+" : syncConflictCount}
                        </span>
                      )}
                      {n.href === "/admin/tracking" && trackingBadge > 0 && (
                        <span
                          className={`ml-auto grid min-w-[1.25rem] place-items-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white ${
                            collapsed ? "lg:absolute lg:right-1 lg:top-1 lg:ml-0" : ""
                          }`}
                        >
                          {trackingBadge > 99 ? "99+" : trackingBadge}
                        </span>
                      )}
                      {n.href === "/admin/dine-in" && pendingDineIn > 0 && (
                        <span
                          className={`ml-auto grid min-w-[1.25rem] place-items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white ${
                            collapsed ? "lg:absolute lg:right-1 lg:top-1 lg:ml-0" : ""
                          }`}
                        >
                          {pendingDineIn > 99 ? "99+" : pendingDineIn}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
            <div
              className="pointer-events-none sticky bottom-0 hidden h-10 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-stone-900 dark:via-stone-900/80 lg:block"
              aria-hidden
            />
          </nav>

          <div className={`hidden border-t border-orange-100/80 p-3 dark:border-stone-700 lg:block ${collapsed ? "px-2" : ""}`}>
            <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
              <div
                className={`flex min-w-0 flex-1 items-center ${collapsed ? "justify-center" : "gap-2"}`}
                title={user.email}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                {!collapsed && (
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{user.name}</span>
                    <span className="block truncate text-xs text-stone-400 dark:text-stone-500">{user.role}</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => { logout(); router.push("/"); }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 shadow-sm transition hover:border-red-300 hover:bg-red-100 hover:text-red-700 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-400 dark:hover:bg-red-950 dark:hover:text-red-300"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={17} />
              </button>
            </div>
            <div className={collapsed ? "mt-2 text-center" : "mt-3 border-t border-orange-100/80 pt-3 px-1 dark:border-stone-700"}>
              <PoweredBy
                variant={collapsed ? "minimal" : "inline"}
                className="[&_a]:font-bold [&_a]:text-violet-600 [&_a:hover]:text-violet-700 dark:[&_a]:text-violet-400 dark:[&_a:hover]:text-violet-300"
              />
            </div>
          </div>
        </div>
      </aside>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden lg:h-dvh lg:max-h-dvh ${
          hideChrome ? "lg:pl-0" : collapsed ? "lg:pl-[4.75rem]" : "lg:pl-72"
        }`}
      >
        <header
          className={`sticky top-0 z-30 flex items-center justify-between overflow-visible border-b border-orange-100/80 bg-[#fffaf5]/90 px-4 py-3 backdrop-blur-md dark:border-stone-700 dark:bg-stone-950/90 sm:px-6 lg:px-8 ${
            hideChrome ? "hidden" : isPos ? "hidden" : ""
          }`}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSidebar}
              className="hidden h-9 w-9 place-items-center rounded-xl border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-brand-200 hover:text-brand-700 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-300 dark:hover:border-brand-500 dark:hover:text-brand-300 lg:grid"
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <div className="min-w-0 leading-tight">
              <p className="font-display text-base font-semibold text-stone-800 dark:text-stone-100 sm:text-lg">
                {now.toLocaleDateString("en-US", { weekday: "long", timeZone: storeTimezone })}
              </p>
              <p className="text-sm font-medium text-stone-600 dark:text-stone-400 sm:text-base">
                {now.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: storeTimezone })}
                <span className="mx-1.5 text-stone-300 dark:text-stone-600">·</span>
                {now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: storeTimezone })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-visible sm:gap-2.5">
            <StaffNotificationCenter />
            <BranchSwitcher />
            <span
              className="hidden h-9 items-center gap-1.5 border-l border-stone-200 pl-2.5 text-xs font-medium text-stone-600 dark:border-stone-700 dark:text-stone-400 sm:inline-flex"
              title={kitchenOpen === false ? "Kitchen is closed to new orders" : "Kitchen accepting orders"}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  kitchenOpen === false ? "bg-amber-500" : kitchenOpen === null ? "bg-stone-300" : "bg-emerald-500"
                }`}
                aria-hidden
              />
              {kitchenOpen === false ? "Closed" : kitchenOpen === null ? "Kitchen" : "Open"}
            </span>
            <AdminThemeToggle theme={theme} onToggle={toggleTheme} className="hidden sm:inline-flex" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800 lg:hidden"
                aria-label="Account menu"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 z-40 mt-2 w-52 rounded-xl border border-stone-200 bg-white p-1 shadow-lg dark:border-stone-600 dark:bg-stone-800 lg:hidden">
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                    onClick={() => { setMenuOpen(false); logout(); router.push("/"); }}
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main
          className={
            isPos
              ? `flex min-h-0 flex-1 flex-col overflow-hidden p-0 ${posFullscreen ? "" : "lg:p-8 lg:pb-8"}`
              : isKitchen
                ? hideChrome
                  ? "fixed inset-0 z-40 flex min-h-0 flex-col overflow-hidden bg-[#fffaf5] p-2 dark:bg-stone-950"
                  : "flex min-h-0 flex-1 flex-col overflow-hidden p-4 pb-24 sm:p-6 sm:pb-6 lg:p-8 lg:pb-8"
                : isDashboard
                  ? "flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-24 pt-1 sm:px-5 sm:pb-6 lg:px-6 lg:pb-8"
                  : "flex min-h-0 flex-1 flex-col overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-6 lg:p-8 lg:pb-8"
          }
        >
          {!hideChrome ? <OpsKitchenAlertBanner /> : null}
          {!hideChrome ? <ApiUpgradeBanner /> : null}
          {children}
        </main>

        <nav
          className={`fixed bottom-0 left-0 right-0 z-30 border-t border-orange-100 bg-white/95 backdrop-blur-md dark:border-stone-700 dark:bg-stone-900/95 lg:hidden ${
            hideChrome || isPos ? "hidden" : ""
          }`}
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${mobileNav.length}, minmax(0, 1fr))` }}>
            {mobileNav.map((n) => {
              const peerHrefs = mobileNav.map((i) => i.href);
              const active = isAdminNavActive(path, n.href, peerHrefs);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[10px] font-semibold ${
                    active ? "text-brand-700 dark:text-brand-400" : "text-stone-400 dark:text-stone-500"
                  }`}
                >
                  <span className="relative">
                    <Icon size={18} strokeWidth={active ? 2.5 : 2} />
                    {n.href === "/admin/dine-in" && pendingDineIn > 0 && (
                      <span className="absolute -right-2 -top-1 grid h-4 min-w-[1rem] place-items-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                        {pendingDineIn > 9 ? "9+" : pendingDineIn}
                      </span>
                    )}
                  </span>
                  {n.label}
                </Link>
              );
            })}
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      </div>
    </div>
    </BranchProvider>
  );
}
