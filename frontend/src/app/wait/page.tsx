import { Suspense } from "react";
import { WaitlistDisplay } from "./WaitlistDisplay";

export default function WaitlistDisplayPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-stone-950 text-stone-400">Loading queue…</div>
      }
    >
      <WaitlistDisplay />
    </Suspense>
  );
}
