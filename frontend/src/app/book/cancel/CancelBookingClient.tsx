"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { cancelPublicReservation } from "@/modules/dine-in/api";

export function CancelBookingClient() {
  const params = useSearchParams();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("err");
      setMessage("Missing cancellation link.");
      return;
    }
    setStatus("busy");
    void cancelPublicReservation(token)
      .then(() => {
        setStatus("ok");
        setMessage("Your booking has been cancelled.");
      })
      .catch((e) => {
        setStatus("err");
        setMessage(e instanceof Error ? e.message : "Could not cancel.");
      });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <h1 className="text-lg font-bold">Cancel booking</h1>
        <p className="mt-3 text-sm text-stone-600 dark:text-stone-300">
          {status === "busy" ? "Cancelling…" : message}
        </p>
      </div>
    </div>
  );
}
