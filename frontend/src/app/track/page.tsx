"use client";

import { StoreShell } from "@/components/StoreShell";
import { OrderTrackForm } from "@/components/OrderTrackForm";

export default function TrackPage() {
  return (
    <StoreShell>
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <OrderTrackForm />
      </div>
    </StoreShell>
  );
}
