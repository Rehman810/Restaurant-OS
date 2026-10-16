"use client";

import { useEffect } from "react";

export function StorePwa() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/store-sw.js", { scope: "/" }).catch(() => null);
  }, []);
  return null;
}
