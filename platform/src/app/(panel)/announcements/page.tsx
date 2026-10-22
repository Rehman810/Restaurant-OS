"use client";

import { FormEvent, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatPktDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: string;
  audience: string;
  startsAt: string;
  endsAt: string | null;
};

export default function AnnouncementsPage() {
  const { can } = usePlatformAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [maintenance, setMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Scheduled maintenance is in progress.");

  function reload() {
    void api<{ announcements: Announcement[] }>("/announcements").then((res) => setItems(res.announcements));
    void api<{ data: { maintenance?: { active?: boolean; message?: string } } }>("/settings").then((res) => {
      const m = res.data?.maintenance;
      setMaintenance(Boolean(m?.active));
      if (m?.message) setMaintenanceMessage(m.message);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  async function createAnnouncement(e: FormEvent) {
    e.preventDefault();
    if (!can("tenants:write")) return;
    setMessage("");
    try {
      await api("/announcements", {
        method: "POST",
        body: JSON.stringify({ title, body, severity: "INFO", audience: "ALL" }),
      });
      setTitle("");
      setBody("");
      setMessage("Announcement published.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not publish.");
    }
  }

  async function applyMaintenance() {
    if (!can("tenants:write")) return;
    setMessage("");
    try {
      await api("/announcements/maintenance", {
        method: "POST",
        body: JSON.stringify({ active: maintenance, message: maintenanceMessage }),
      });
      setMessage(maintenance ? "Maintenance mode enabled." : "Maintenance mode disabled.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not update maintenance.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Announcements" description="Tenant banners and platform maintenance" />
      {message ? (
        <p className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-2 text-sm text-accent-800 dark:border-accent-900 dark:bg-accent-950/40 dark:text-accent-100">
          {message}
        </p>
      ) : null}

      <PanelCard title="Maintenance mode" description="Blocks non-GET tenant API writes while active">
        {can("tenants:write") ? (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} />
              Enable maintenance
            </label>
            <label className="mt-3 block text-sm">
              Message shown to tenants
              <input className="input mt-1" value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary mt-4" onClick={() => void applyMaintenance()}>Apply</button>
          </>
        ) : (
          <p className="text-sm">Status: <strong>{maintenance ? "ON" : "OFF"}</strong></p>
        )}
      </PanelCard>

      {can("tenants:write") ? (
        <PanelCard title="New banner">
          <form onSubmit={createAnnouncement} className="space-y-3">
            <input className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            <textarea className="input min-h-[88px]" placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />
            <button type="submit" className="btn-primary">Publish</button>
          </form>
        </PanelCard>
      ) : null}

      <PanelCard title="Active & recent">
        <ul className="space-y-3">
          {items.length === 0 ? (
            <li className="text-sm text-slate-500">No announcements yet.</li>
          ) : (
            items.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-800/30">
                <p className="font-medium">{a.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a.body}</p>
                <p className="mt-2 text-xs text-slate-400">
                  {a.severity} · {a.audience} · {formatPktDate(a.startsAt)}
                </p>
              </li>
            ))
          )}
        </ul>
      </PanelCard>
    </div>
  );
}
