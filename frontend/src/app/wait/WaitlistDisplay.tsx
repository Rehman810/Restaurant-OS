"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchPublicWaitlist } from "@/modules/dine-in/api";

export function WaitlistDisplay() {
  const params = useSearchParams();
  const branchId = params.get("branchId") || "";
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchPublicWaitlist>> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!branchId) {
      setError("Add ?branchId=… to the URL (open Guest display from Admin → Dine-in → Walk-in queue).");
      return;
    }
    try {
      setData(await fetchPublicWaitlist(branchId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load queue");
    }
  }, [branchId]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="text-center">
          <p className="text-sm uppercase tracking-widest text-stone-400">Walk-in queue</p>
          <h1 className="mt-2 font-display text-3xl font-bold">{data?.branchName ?? "Restaurant"}</h1>
          <p className="mt-2 text-stone-400">Queue numbers and estimated wait — updated live</p>
        </header>

        {error && <p className="mt-8 rounded-xl bg-red-950/50 px-4 py-3 text-center text-red-200">{error}</p>}

        {!error && data && (
          <ul className="mt-10 space-y-3">
            {data.queue.length === 0 && (
              <li className="rounded-2xl border border-stone-800 py-16 text-center text-stone-500">
                No wait right now — ask staff for a table.
              </li>
            )}
            {data.queue.map((row) => (
              <li
                key={row.queueNumber}
                className={`flex items-center justify-between rounded-2xl border px-6 py-5 ${
                  row.status === "CALLED" ? "border-indigo-400 bg-indigo-950/40" : "border-stone-800 bg-stone-900/60"
                }`}
              >
                <div className="flex items-center gap-5">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white text-2xl font-bold text-stone-900">
                    {row.queueNumber}
                  </span>
                  <div>
                    <p className="text-lg font-semibold">{row.partySize} guests</p>
                    <p className="text-sm text-stone-400">{row.seating}</p>
                  </div>
                </div>
                <div className="text-right">
                  {row.status === "CALLED" ? (
                    <p className="text-lg font-bold text-indigo-300">Please see the host</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">~{row.estimatedWaitMin} min</p>
                      <p className="text-xs text-stone-500">Position {row.position}</p>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
