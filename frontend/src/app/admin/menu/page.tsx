"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy `/admin/menu` → catalog modules */
export default function MenuLegacyRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "deals" || tab === "offers") router.replace("/admin/catalog/offers");
    else if (tab === "categories") router.replace("/admin/catalog/categories");
    else router.replace("/admin/catalog/dishes");
  }, [router, searchParams]);

  return null;
}
