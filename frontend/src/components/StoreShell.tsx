import { Navbar } from "@/components/Navbar";
import { RoleRedirect } from "@/components/RoleRedirect";
import { StoreFooter } from "@/components/StoreFooter";
import { StorefrontExtras } from "@/components/StorefrontExtras";
import { StorefrontLocaleProvider } from "@/lib/i18n/storefront";

export function StoreShell({ children }: { children: React.ReactNode }) {
  return (
    <StorefrontLocaleProvider>
      <div className="flex min-h-screen flex-col">
        <RoleRedirect />
        <Navbar />
        <StorefrontExtras />
        <main className="flex-1">{children}</main>
        <StoreFooter />
      </div>
    </StorefrontLocaleProvider>
  );
}
