"use client";

import { Suspense } from "react";
import { InventoryModule } from "@/modules/inventory/InventoryModule";

export default function InventoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-stone-500">Loading inventory…</div>}>
      <InventoryModule />
    </Suspense>
  );
}
