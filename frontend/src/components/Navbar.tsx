"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ShoppingBag, Menu, MapPin, X } from "lucide-react";
import { StoreLogo } from "@/components/StoreLogo";
import { dashboardLabel, homeFor, isStaffRole, useAuth } from "@/lib/auth";
import { storeDisplayName } from "@/lib/branding";
import { useStore } from "@/lib/store";
import { cartCount, useCart } from "@/lib/cart";
import { useFulfillment } from "@/lib/fulfillment";

export function Navbar() {
  const path = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const store = useStore();
  const brandName = storeDisplayName(store?.settings);
  const items = useCart((s) => s.items);
  const bounce = useCart((s) => s.bounce);
  const count = cartCount(items);
  const { mode, areaName, branchName, setOpenModal } = useFulfillment();
  const [open, setOpen] = useState(false);

  const isCustomer = !user || user.role === "CUSTOMER";
  const staffHome = user && isStaffRole(user.role) ? homeFor(user.role) : null;

  const links = isCustomer
    ? [
        { href: "/", label: "Home", match: (p: string) => p === "/" },
        { href: "/menu", label: "Menu", match: (p: string) => p.startsWith("/menu") },
        { href: "/orders", label: user ? "Orders" : "Track order", match: (p: string) => p.startsWith("/orders") },
      ]
    : [];

  return (
    <>
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl"
        style={{
          borderColor: "var(--brand-surface-border)",
          backgroundColor: "color-mix(in srgb, var(--brand-navbar) 95%, transparent)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <StoreLogo
              logoUrl={store?.settings.logoUrl}
              size="sm"
              rounded="full"
              fallbackClassName="bg-brand-600 text-white sm:rounded-full"
              className="sm:rounded-full"
            />
            <span className="truncate text-sm font-extrabold tracking-tight text-ink sm:text-base">
              {brandName}
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => {
              const active = l.match(path);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold leading-none ${
                    active ? "bg-brand-50 text-brand-800" : "text-stone-600 hover:bg-white hover:text-ink"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => setOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white text-ink md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            {isCustomer && (
              <button
                onClick={() => setOpenModal(true)}
                className="hidden h-9 max-w-[120px] items-center gap-1.5 truncate rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-ink sm:inline-flex sm:h-10"
                title="Change delivery or takeaway"
              >
                <MapPin size={14} className="shrink-0 text-brand-600" />
                <span className="truncate">
                  {mode === "PICKUP" ? branchName || "Takeaway" : areaName || "Delivery"}
                </span>
              </button>
            )}
            {isCustomer && (
              <button
                onClick={() => useCart.getState().setDrawer(true)}
                className={`relative grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white text-ink transition sm:h-10 sm:w-10 ${
                  bounce ? "scale-105" : ""
                }`}
                aria-label="Open cart"
              >
                <ShoppingBag size={17} strokeWidth={2} />
                {count > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold leading-none text-white">
                    {count}
                  </span>
                )}
              </button>
            )}
            {staffHome && user ? (
              <>
                <Link
                  href="/menu"
                  className="hidden h-10 items-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold leading-none text-ink hover:bg-brand-50 sm:inline-flex"
                >
                  View menu
                </Link>
                <Link
                  href={staffHome}
                  className="hidden h-10 items-center rounded-full bg-brand-600 px-4 text-sm font-semibold leading-none text-white hover:bg-brand-700 sm:inline-flex"
                >
                  {dashboardLabel(user.role)}
                </Link>
                <button
                  onClick={() => {
                    logout();
                    router.push("/");
                  }}
                  className="hidden h-10 items-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold leading-none text-ink sm:inline-flex"
                >
                  Sign out
                </button>
              </>
            ) : user ? (
              <button
                onClick={() => {
                  logout();
                  router.push("/");
                }}
                className="hidden h-10 items-center rounded-full border border-stone-200 bg-white px-4 text-sm font-semibold leading-none text-ink sm:inline-flex"
              >
                Sign out
              </button>
            ) : (
              <>
                <Link
                  href="/register"
                  className="hidden h-9 items-center rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold leading-none text-ink hover:bg-brand-50 sm:inline-flex sm:h-10 sm:px-4 sm:text-sm"
                >
                  Register
                </Link>
                <Link
                  href="/login"
                  className="hidden h-9 items-center rounded-full bg-brand-600 px-3 text-xs font-semibold leading-none text-white hover:bg-brand-700 sm:inline-flex sm:h-10 sm:px-4 sm:text-sm"
                >
                  Sign in
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute right-0 top-0 flex h-full w-[min(100%,280px)] flex-col bg-[#fffaf5] shadow-float">
            <div className="flex items-center justify-between border-b border-orange-100 px-4 py-4">
              <p className="font-display text-lg">Menu</p>
              <button
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-3">
              {staffHome && user ? (
                <>
                  <Link
                    href={staffHome}
                    onClick={() => setOpen(false)}
                    className="rounded-2xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white"
                  >
                    {dashboardLabel(user.role)}
                  </Link>
                  <Link
                    href="/menu"
                    onClick={() => setOpen(false)}
                    className="rounded-2xl px-4 py-3.5 text-base font-semibold text-stone-700 hover:bg-brand-50"
                  >
                    View menu
                  </Link>
                </>
              ) : (
                links.map((l) => {
                  const active = l.match(path);
                  return (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className={`rounded-2xl px-4 py-3.5 text-base font-semibold ${
                        active ? "bg-brand-600 text-white" : "text-stone-700 hover:bg-brand-50"
                      }`}
                    >
                      {l.label}
                    </Link>
                  );
                })
              )}
            </nav>
            <div className="mt-auto border-t border-orange-100 p-4">
              {staffHome && user ? (
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                    router.push("/");
                  }}
                  className="btn-ghost w-full"
                >
                  Sign out
                </button>
              ) : user ? (
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                    router.push("/");
                  }}
                  className="btn-ghost w-full"
                >
                  Sign out
                </button>
              ) : (
                <div className="grid gap-2">
                  <Link href="/register" onClick={() => setOpen(false)} className="btn-ghost w-full">
                    Create account
                  </Link>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-primary w-full">
                    Sign in
                  </Link>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
