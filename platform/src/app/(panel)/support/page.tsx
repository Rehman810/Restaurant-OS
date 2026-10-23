"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { TenantRow } from "@/lib/types";
import { formatPktDate } from "@/lib/format";
import { usePlatformAuth } from "@/lib/auth";
import { ForbiddenPage } from "@/components/RequirePermission";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { DataTable, TableEmpty } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  restaurant: { id: string; slug: string; displayName: string };
};

export default function SupportTicketsPage() {
  const { can } = usePlatformAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [status, setStatus] = useState("");
  const [newTenantId, setNewTenantId] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [message, setMessage] = useState("");

  function reloadTickets() {
    const q = status ? `?status=${encodeURIComponent(status)}` : "";
    void api<{ tickets: Ticket[] }>(`/support-tickets${q}`)
      .then((r) => setTickets(r.tickets))
      .catch(() => undefined);
  }

  useEffect(() => {
    if (!can("tenants:read")) return;
    reloadTickets();
  }, [status, can]);

  useEffect(() => {
    if (!can("tenants:read")) return;
    void api<{ tenants: TenantRow[] }>("/tenants").then((r) => setTenants(r.tenants)).catch(() => undefined);
  }, [can]);

  async function createTicket() {
    if (!can("support:write")) return;
    setMessage("");
    try {
      await api("/support-tickets", {
        method: "POST",
        body: JSON.stringify({ restaurantId: newTenantId, subject: newSubject, body: newBody }),
      });
      setNewSubject("");
      setNewBody("");
      setMessage("Ticket created.");
      reloadTickets();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not create ticket.");
    }
  }

  if (!can("tenants:read")) return <ForbiddenPage />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Operate" title="Support tickets" description="Tenant issues tracked by the platform team.">
        <LifeBuoy className="h-5 w-5 text-accent-400" aria-hidden />
      </PageHeader>
      {message ? <p className="flash-ok">{message}</p> : null}
      {can("support:write") ? (
        <PanelCard title="New ticket">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Tenant</span>
              <select className="input" value={newTenantId} onChange={(e) => setNewTenantId(e.target.value)}>
                <option value="">Select tenant</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.displayName} ({t.slug})</option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Subject</span>
              <input className="input" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="field-label">Message</span>
              <textarea className="input min-h-20" value={newBody} onChange={(e) => setNewBody(e.target.value)} />
            </label>
            <button type="button" className="btn-primary sm:col-span-2" onClick={() => void createTicket()}>Create</button>
          </div>
        </PanelCard>
      ) : null}
      <PanelCard title="Queue">
        <div className="mb-4 flex flex-wrap gap-2">
          {["", "OPEN", "PENDING", "RESOLVED", "CLOSED"].map((s) => (
            <button
              key={s || "all"}
              type="button"
              className={`btn-secondary text-xs ${status === s ? "ring-1 ring-accent-400" : ""}`}
              onClick={() => setStatus(s)}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        {tickets.length === 0 ? (
          <TableEmpty>No tickets match this filter.</TableEmpty>
        ) : (
          <DataTable>
            <thead>
              <tr>
                {["Tenant", "Subject", "Status", "Priority", "Updated"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/tenants/${t.restaurant.id}`} className="text-accent-400 hover:underline">
                      {t.restaurant.displayName}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/support/${t.id}`} className="font-medium hover:underline">
                      {t.subject}
                    </Link>
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{t.priority}</td>
                  <td>{formatPktDate(t.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </PanelCard>
    </div>
  );
}
