"use client";

import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/auth";
import { StoreProvider } from "@/lib/store";
import type { PublicStore } from "@/lib/types";
import { CartDrawer } from "./CartDrawer";
import { FulfillmentModal } from "./FulfillmentModal";
import { DealDetailModal } from "./DealDetailModal";
import { ItemDeepLink } from "./ItemDeepLink";
import { ItemDetailModal } from "./ItemDetailModal";
import { KeepAlive } from "./KeepAlive";
import { ViewCartBar } from "./ViewCartBar";

function isCustomerSurface(pathname: string) {
  if (pathname === "/login") return false;
  if (pathname.startsWith("/admin") || pathname.startsWith("/rider")) return false;
  return true;
}

function CustomerOverlays() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!isCustomerSurface(pathname)) return null;
  if (user && user.role !== "CUSTOMER" && user.role !== "ADMIN") return null;
  const hideCartBar = pathname === "/checkout";
  return (
    <>
      <FulfillmentModal />
      <ItemDeepLink />
      <ItemDetailModal />
      <DealDetailModal />
      {!hideCartBar && <ViewCartBar />}
      <CartDrawer />
    </>
  );
}

export function Providers({
  children,
  initialStore = null,
}: {
  children: React.ReactNode;
  initialStore?: PublicStore | null;
}) {
  return (
    <AuthProvider>
      <StoreProvider initialStore={initialStore}>
        <KeepAlive />
        {children}
        <CustomerOverlays />
      </StoreProvider>
    </AuthProvider>
  );
}
