"use client";

import { usePlatformAuth } from "@/lib/auth";
import { formatPktDate, formatPkr } from "@/lib/format";
import { PanelCard } from "./PanelCard";
import { RecordInvoicePayment, type InvoiceRow } from "./RecordInvoicePayment";
import { StatusBadge } from "./StatusBadge";

export function TenantInvoicesSection({
  invoices,
  onRefresh,
}: {
  invoices: InvoiceRow[];
  onRefresh: () => void;
}) {
  const { can } = usePlatformAuth();

  return (
    <PanelCard title="Billing" description="Platform invoices and manual payment recording">
      {invoices.length === 0 ? (
        <p className="text-sm text-slate-500">No platform invoices yet. The billing job creates these each period.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800">
                <th className="pb-3 pr-4 font-medium">Invoice</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
                <th className="pb-3 pr-4 font-medium">Amount</th>
                <th className="pb-3 pr-4 font-medium">Due</th>
                {can("billing:write") ? <th className="pb-3 font-medium">Payment</th> : null}
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-50 align-top dark:border-slate-800/80">
                  <td className="py-3 pr-4 font-mono text-xs">{inv.invoiceNumber}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="py-3 pr-4 font-medium">{formatPkr(inv.amountPkr)}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-400">{formatPktDate(inv.dueAt)}</td>
                  {can("billing:write") ? (
                    <td className="py-3">
                      {inv.status === "OPEN" ? (
                        <RecordInvoicePayment invoice={inv} onRecorded={onRefresh} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelCard>
  );
}
