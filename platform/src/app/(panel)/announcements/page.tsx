"use client";

import { FormEvent, useEffect, useState } from "react";
import { Mail, Megaphone, Radio, Smartphone } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/auth";
import { formatPktDate } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { EmptyState } from "@/components/EmptyState";

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: string;
  audience: string;
  startsAt: string;
  endsAt: string | null;
};

const SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;

export default function AnnouncementsPage() {
  const { can } = usePlatformAuth();
  const [items, setItems] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>("INFO");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyInApp, setNotifyInApp] = useState(true);
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
      const res = await api<{ delivery?: { tenantCount: number } }>("/announcements", {
        method: "POST",
        body: JSON.stringify({
          title,
          body,
          severity,
          audience: "ALL",
          notifyEmail,
          notifyInApp,
        }),
      });
      setTitle("");
      setBody("");
      const n = res.delivery?.tenantCount ?? 0;
      setMessage(`Broadcast sent to ${n} tenant(s) — dashboard banner, notifications${notifyEmail ? ", and email" : ""}.`);
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not publish.");
    }
  }

  async function applyMaintenance() {
    if (!can("tenants:write")) return;
    setMessage("");
    try {
      const res = await api<{ delivery?: { tenantCount: number } }>("/announcements/maintenance", {
        method: "POST",
        body: JSON.stringify({ active: maintenance, message: maintenanceMessage }),
      });
      if (maintenance) {
        const n = res.delivery?.tenantCount ?? 0;
        setMessage(`Maintenance enabled — banner + notifications + email sent to ${n} tenant(s).`);
      } else {
        setMessage("Maintenance mode disabled.");
      }
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not update maintenance.");
    }
  }

  const previewTone =
    severity === "CRITICAL"
      ? "border-rose-500/30 bg-rose-500/10"
      : severity === "WARNING"
        ? "border-amber-500/30 bg-amber-500/10"
        : "border-sky-500/30 bg-sky-500/10";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Comms"
        title="Broadcasts"
        description="Reach store owners on their admin dashboard, in-app notifications, and owner/admin email"
      />
      {message ? <p className="flash-ok">{message}</p> : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <PanelCard title="Maintenance mode" description="Read-only browsing stays on; writes return 503 with your message">
          {can("tenants:write") ? (
            <>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-accent-600 focus:ring-accent-500"
                  checked={maintenance}
                  onChange={(e) => setMaintenance(e.target.checked)}
                />
                Enable maintenance
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${maintenance ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"}`}
                >
                  {maintenance ? "ON" : "OFF"}
                </span>
              </label>
              <label className="mt-4 block text-sm">
                <span className="field-label">Message on tenant admin + email</span>
                <textarea className="input min-h-[72px]" value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} />
              </label>
              <p className="mt-2 text-xs text-slate-500">Applying while ON notifies all active tenants once.</p>
              <button type="button" className="btn-secondary mt-4" onClick={() => void applyMaintenance()}>Apply maintenance</button>
            </>
          ) : (
            <p className="text-sm">Status: <strong>{maintenance ? "ON" : "OFF"}</strong></p>
          )}
        </PanelCard>

        {can("tenants:write") ? (
          <PanelCard title="New broadcast" description="All active tenants unless audience rules are added later">
            <form onSubmit={createAnnouncement} className="space-y-4">
              <label className="block text-sm">
                <span className="field-label">Title</span>
                <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. Billing update" />
              </label>
              <label className="block text-sm">
                <span className="field-label">Message</span>
                <textarea className="input min-h-[88px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="What store owners should know" />
              </label>
              <label className="block text-sm">
                <span className="field-label">Severity</span>
                <select className="input" value={severity} onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery</p>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked className="h-4 w-4 rounded" disabled />
                  <Radio className="h-4 w-4 text-accent-400" aria-hidden />
                  Dashboard banner (always)
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded" checked={notifyInApp} onChange={(e) => setNotifyInApp(e.target.checked)} />
                  <Smartphone className="h-4 w-4 text-accent-400" aria-hidden />
                  In-app notification bell
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
                  <Mail className="h-4 w-4 text-accent-400" aria-hidden />
                  Owner + admin email
                </label>
              </div>
              {(title || body) && (
                <div className={`rounded-xl border px-3 py-2.5 text-sm ${previewTone}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">Tenant preview</p>
                  <p className="mt-1 font-semibold">{title || "Title"}</p>
                  {body ? <p className="mt-0.5 opacity-90">{body}</p> : null}
                </div>
              )}
              <button type="submit" className="btn-primary w-full sm:w-auto">
                <Megaphone className="h-4 w-4" aria-hidden />
                Send broadcast
              </button>
            </form>
          </PanelCard>
        ) : null}
      </div>

      <PanelCard title="Broadcast history">
        {items.length === 0 ? (
          <EmptyState icon={Megaphone} title="No broadcasts yet" description="Sent messages appear here for operators." />
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4 dark:border-white/[0.06] dark:bg-white/[0.03]">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{a.title}</p>
                  <span className="rounded-full bg-accent-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-300">
                    {a.severity}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a.body}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {a.audience} · {formatPktDate(a.startsAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
}
