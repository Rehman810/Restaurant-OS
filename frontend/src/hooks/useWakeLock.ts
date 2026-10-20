"use client";

import { useEffect, useRef } from "react";

/** Keeps the screen awake while `enabled` (Screen Wake Lock API). */
export function useWakeLock(enabled: boolean) {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("wakeLock" in navigator)) {
      return;
    }

    let cancelled = false;

    async function acquire() {
      try {
        if (lockRef.current) return;
        lockRef.current = await navigator.wakeLock.request("screen");
        lockRef.current.addEventListener("release", () => {
          lockRef.current = null;
        });
      } catch {
        lockRef.current = null;
      }
    }

    void acquire();

    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lockRef.current?.release();
      lockRef.current = null;
    };
  }, [enabled]);
}
