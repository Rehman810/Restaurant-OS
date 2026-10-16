import { Suspense } from "react";
import { CancelBookingClient } from "./CancelBookingClient";

export default function CancelBookingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-stone-500">Loading…</div>
      }
    >
      <CancelBookingClient />
    </Suspense>
  );
}
