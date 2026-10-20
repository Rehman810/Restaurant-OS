"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderTree, Sparkles, TicketPercent, UtensilsCrossed } from "lucide-react";
import { AdminSurface } from "@/components/admin/ui";

const LINKS = [
  { href: "/admin/catalog/dishes", label: "Dishes", icon: UtensilsCrossed },
  { href: "/admin/catalog/offers", label: "Offers", icon: Sparkles },
  { href: "/admin/catalog/vouchers", label: "Vouchers", icon: TicketPercent },
  { href: "/admin/catalog/categories", label: "Categories", icon: FolderTree },
] as const;

export function CatalogSubNav() {
  const path = usePathname();
  return (
    <AdminSurface className="sticky top-0 z-30">
      <nav aria-label="Catalog sections" className="flex gap-1 overflow-x-auto p-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={16} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
    </AdminSurface>
  );
}
