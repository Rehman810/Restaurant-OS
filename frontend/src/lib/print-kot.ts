import { api } from "./api";
import { recordKotPrint } from "./admin-kitchen";
import { Order } from "./types";
import { receiptPhone, ReceiptStore } from "./print-receipt";

export type KotTicketPayload = {
  stationId: string;
  stationName: string;
  stationCode: string;
  items: {
    id: string;
    quantity: number;
    nameAtOrder: string;
    optionsLabel: string;
    instructions: string;
  }[];
};

export type KotResponse = {
  order: Pick<
    Order,
    | "id"
    | "orderNumber"
    | "status"
    | "fulfillmentType"
    | "customerName"
    | "customerPhone"
    | "tableNumber"
    | "notes"
    | "createdAt"
  >;
  store: ReceiptStore;
  tickets: KotTicketPayload[];
};

export async function fetchKot(orderId: string) {
  return api<KotResponse>(`/admin/kot/orders/${orderId}`);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const BASE_STYLES = `
  @page { size: 80mm auto; margin: 4mm; }
  body { width: 72mm; font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.35; color: #1c1917; padding: 2mm; }
  .center { text-align: center; }
  .order-no { font-size: 20px; font-weight: 800; }
  .station { font-size: 13px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
  .meta { font-size: 10px; color: #57534e; margin-top: 4px; }
  .rule { border: none; border-top: 1px dashed #d6d3d1; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { vertical-align: top; padding: 3px 0; }
  .qty { width: 22px; font-weight: 700; }
  .muted { font-size: 9px; color: #78716c; }
`;

function kotTicketHtml(
  order: KotResponse["order"],
  store: ReceiptStore,
  ticket: KotTicketPayload,
  reprint: boolean
) {
  const time = new Date(order.createdAt).toLocaleString("en-PK", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const phone = receiptPhone(order.customerPhone);
  const rows = ticket.items
    .map(
      (i) => `
    <tr>
      <td class="qty">${i.quantity}×</td>
      <td><strong>${esc(i.nameAtOrder)}</strong>
        ${i.optionsLabel ? `<div class="muted">${esc(i.optionsLabel)}</div>` : ""}
        ${i.instructions ? `<div class="muted">Note: ${esc(i.instructions)}</div>` : ""}
      </td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${BASE_STYLES}
  .reprint { font-size: 16px; font-weight: 900; letter-spacing: 0.2em; color: #b91c1c; margin: 6px 0; }
  </style></head><body>
    ${reprint ? `<div class="center reprint">REPRINT</div>` : ""}
    <div class="center station">${esc(ticket.stationName)} · ${esc(ticket.stationCode)}</div>
    <div class="center"><div class="order-no">${esc(order.orderNumber)}</div><div class="meta">${time}</div></div>
    <hr class="rule" />
    <div class="meta">${esc(order.customerName)}${phone ? ` · ${esc(phone)}` : ""}${order.tableNumber ? ` · Table ${esc(order.tableNumber)}` : ""}</div>
    ${order.notes ? `<div class="meta" style="margin-top:6px;"><strong>Order:</strong> ${esc(order.notes)}</div>` : ""}
    <table>${rows}</table>
    <hr class="rule" />
    <div class="center meta">${esc(store.name)} · KOT</div>
    <script>window.onload=function(){window.print();}</script>
  </body></html>`;
}

function openPrint(html: string, title: string) {
  const w = window.open("", "_blank", "width=400,height=720");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  return true;
}

export async function printKotForOrder(orderId: string) {
  const data = await fetchKot(orderId);
  if (!data.tickets.length) {
    throw new Error("No kitchen tickets for this order.");
  }
  const printMeta = await recordKotPrint(orderId);
  const reprint = printMeta.isReprint;
  data.tickets.forEach((ticket, index) => {
    const html = kotTicketHtml(data.order, data.store, ticket, reprint);
    setTimeout(() => {
      openPrint(html, `KOT ${data.order.orderNumber} ${ticket.stationCode}`);
    }, index * 500);
  });
  return { ...data, printMeta };
}

export function formatKotSummary(tickets: KotTicketPayload[]) {
  const items = tickets.reduce((n, t) => n + t.items.reduce((s, i) => s + i.quantity, 0), 0);
  return `${tickets.length} station${tickets.length === 1 ? "" : "s"} · ${items} items`;
}
