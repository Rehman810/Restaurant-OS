"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  dismissible: boolean;
};

const tone: Record<Announcement["severity"], string> = {
  INFO: "border-sky-500/40 bg-sky-500/10 text-sky-950 dark:text-sky-100",
  WARNING: "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100",
  CRITICAL: "border-rose-500/40 bg-rose-500/10 text-rose-950 dark:text-rose-100",
};

export function TenantAnnouncementBanner() {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    void api<{ announcements: Announcement[] }>("/admin/announcements")
      .then((res) => setItems(res.announcements ?? []))
      .catch(() => setItems([]));
  }, []);

  if (!items.length) return null;

  return (
    <div className="space-y-2 px-4 pt-3 lg:px-6">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm ${tone[item.severity]}`}
          role="status"
        >
          <div>
            <p className="font-medium">{item.title}</p>
            {item.body ? <p className="mt-1 opacity-90">{item.body}</p> : null}
          </div>
          {item.dismissible ? (
            <button
              type="button"
              className="rounded-lg p-1 opacity-70 hover:opacity-100"
              aria-label="Dismiss"
              onClick={() => {
                void api(`/admin/announcements/${item.id}/dismiss`, { method: "POST" }).then(() =>
                  setItems((prev) => prev.filter((a) => a.id !== item.id))
                );
              }}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
