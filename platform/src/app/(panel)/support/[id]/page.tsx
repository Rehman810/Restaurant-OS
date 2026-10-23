"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { formatPktDate } from "@/lib/format";
import { usePlatformAuth } from "@/lib/auth";
import { BackLink } from "@/components/BackLink";
import { PageHeader } from "@/components/PageHeader";
import { PanelCard } from "@/components/PanelCard";
import { StatusBadge } from "@/components/StatusBadge";

type Message = { id: string; body: string; authorEmail: string; isOperator: boolean; createdAt: string };
type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  restaurant: { id: string; displayName: string; slug: string };
  messages: Message[];
};

export default function SupportTicketDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { can } = usePlatformAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [reply, setReply] = useState("");
  const [message, setMessage] = useState("");

  function reload() {
    void api<{ ticket: Ticket }>(`/support-tickets/${id}`).then((r) => setTicket(r.ticket)).catch(() => undefined);
  }

  useEffect(() => {
    reload();
  }, [id]);

  async function sendReply(e: FormEvent) {
    e.preventDefault();
    if (!can("support:write") || !reply.trim()) return;
    setMessage("");
    try {
      await api(`/support-tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: reply.trim() }),
      });
      setReply("");
      setMessage("Reply sent.");
      reload();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Could not send reply.");
    }
  }

  async function setStatus(status: string) {
    if (!can("support:write")) return;
    await api(`/support-tickets/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    reload();
  }

  if (!ticket) return <div className="h-48 animate-pulse rounded-2xl bg-white/5" />;

  return (
    <div className="space-y-6">
      <BackLink href="/support" label="Support" />
      <PageHeader title={ticket.subject} description={`${ticket.restaurant.displayName} · ${ticket.restaurant.slug}`}>
        <StatusBadge status={ticket.status} />
      </PageHeader>
      {message ? <p className="flash-ok">{message}</p> : null}
      {can("support:write") ? (
        <div className="flex flex-wrap gap-2">
          {["OPEN", "PENDING", "RESOLVED", "CLOSED"].map((s) => (
            <button key={s} type="button" className="btn-secondary text-xs" onClick={() => void setStatus(s)}>
              Mark {s}
            </button>
          ))}
        </div>
      ) : null}
      <PanelCard title="Conversation">
        <ul className="space-y-4">
          {ticket.messages.map((m) => (
            <li key={m.id} className={`rounded-xl border p-3 text-sm ${m.isOperator ? "border-accent-500/30 bg-accent-500/5" : "border-white/10"}`}>
              <p className="text-xs text-slate-500">{m.authorEmail} · {formatPktDate(m.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ul>
        {can("support:write") ? (
          <form className="mt-4 space-y-2" onSubmit={sendReply}>
            <textarea className="input min-h-24" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to tenant…" />
            <button type="submit" className="btn-primary">Send reply</button>
          </form>
        ) : null}
      </PanelCard>
    </div>
  );
}
