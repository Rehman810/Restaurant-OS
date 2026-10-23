"use client";

import { useEffect } from "react";
import { syncPosQueue } from "@/lib/offline/pos-sync";

export default function PosLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/pos-sw.js", { scope: "/admin/pos/" }).catch(() => null);

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "POS_SYNC") void syncPosQueue();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);

    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = "/pos-manifest.json";
    document.head.appendChild(link);
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      link.remove();
    };
  }, []);

  return children;
}
