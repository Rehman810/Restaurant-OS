import { formatMoney } from "./format";
import { Order } from "./types";

export type ReceiptStore = {
  name: string;
  phone: string;
  address: string;
  whatsapp?: string;
  footer?: string;
  taxNumber?: string;
};

export type PrintReceiptOptions = {
  cashier?: string;
  /** Default: both customer receipt and kitchen ticket */
  copies?: "both" | "customer" | "kitchen";
};

const PLACEHOLDER_PHONES = new Set(["03000000000", "0300000000", "0000000000", ""]);

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatPkr(n: number | string) {
  return formatMoney(n);
}

function fulfillmentLabel(type?: string | null) {
  if (type === "DINE_IN") return "Dine-in";
  if (type === "PICKUP") return "Takeaway";
  return "Delivery";
}

function paymentLabel(method?: string | null) {
  if (method === "CARD") return "Card";
  return "Cash";
}

/** Hide walk-in placeholder numbers on printed receipts. */
export function receiptPhone(phone?: string | null) {
  const cleaned = (phone || "").replace(/[^\d+]/g, "").trim();
  if (!cleaned || PLACEHOLDER_PHONES.has(cleaned)) return null;
  return phone!.trim();
}

const BASE_STYLES = `
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 72mm;
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.35;
    color: #1c1917;
    padding: 2mm;
  }
  .center { text-align: center; }
  .brand { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; }
  .tag { font-size: 9px; color: #78716c; margin-top: 2px; }
  .rule { border: none; border-top: 1px dashed #d6d3d1; margin: 8px 0; }
  .rule-bold { border: none; border-top: 2px solid #1c1917; margin: 10px 0 6px; }
  .order-no { font-size: 20px; font-weight: 800; letter-spacing: 0.04em; }
  .meta { font-size: 10px; color: #57534e; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  td { vertical-align: top; padding: 3px 0; }
  .qty { width: 22px; font-weight: 700; }
  .name { padding-right: 4px; }
  .amt { text-align: right; white-space: nowrap; font-weight: 600; }
  .muted { font-size: 9px; color: #78716c; margin-top: 1px; }
  .totals { margin-top: 6px; font-size: 11px; }
  .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
  .grand { font-size: 14px; font-weight: 800; margin-top: 4px; }
  .badge {
    display: inline-block;
    margin-top: 6px;
    padding: 2px 8px;
    border: 1px solid #1c1917;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .copy-label {
    margin-top: 8px;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #a8a29e;
    text-align: center;
  }
  .footer { margin-top: 6px; font-size: 9px; color: #78716c; text-align: center; }
  .thanks { margin-top: 8px; font-size: 12px; font-weight: 700; text-align: center; }
  .urdu { margin-top: 4px; font-size: 11px; font-weight: 600; text-align: center; direction: rtl; }
  .kitchen-title {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    text-align: center;
    margin-bottom: 4px;
  }
`;

function printScript() {
  return `<script>window.onload = function() { window.print(); };</script>`;
}

export function customerReceiptHtml(order: Order, store: ReceiptStore, cashier?: string) {
  const date = new Date(order.createdAt).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const phone = receiptPhone(order.customerPhone);
  const items = order.items
    .map((i) => {
      const opts = i.optionsLabel ? `<div class="muted">${esc(i.optionsLabel)}</div>` : "";
      const note = i.instructions ? `<div class="muted">Note: ${esc(i.instructions)}</div>` : "";
      return `
        <tr>
          <td class="qty">${i.quantity}×</td>
          <td class="name">${esc(i.nameAtOrder)}${opts}${note}</td>
          <td class="amt">${formatPkr(Number(i.priceAtOrder) * i.quantity)}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${esc(order.orderNumber)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="center">
    <div class="brand">${esc(store.name)}</div>
    <div class="tag">${esc(store.address)}</div>
    <div class="tag">Tel: ${esc(store.phone)}</div>
  </div>
  <hr class="rule-bold" />
  <div class="center">
    <div class="order-no">${esc(order.orderNumber)}</div>
    <div class="meta">${date}</div>
    <span class="badge">${fulfillmentLabel(order.fulfillmentType)}</span>
    ${order.tableNumber ? `<div class="meta">Table ${esc(order.tableNumber)}</div>` : ""}
  </div>
  <hr class="rule" />
  <div class="meta">Customer: <strong>${esc(order.customerName)}</strong></div>
  ${phone ? `<div class="meta">Phone: ${esc(phone)}</div>` : ""}
  ${order.notes ? `<div class="meta">Note: ${esc(order.notes)}</div>` : ""}
  <table>${items}</table>
  <hr class="rule" />
  <div class="totals">
    ${order.subtotal != null ? `<div><span>Subtotal</span><span>${formatPkr(order.subtotal)}</span></div>` : ""}
    ${Number(order.taxAmount || 0) > 0 ? `<div><span>Tax</span><span>${formatPkr(order.taxAmount!)}</span></div>` : ""}
    ${Number(order.serviceAmount || 0) > 0 ? `<div><span>Service</span><span>${formatPkr(order.serviceAmount!)}</span></div>` : ""}
    ${Number(order.deliveryCharge || 0) > 0 ? `<div><span>Delivery</span><span>${formatPkr(order.deliveryCharge!)}</span></div>` : ""}
    <div class="grand"><span>TOTAL</span><span>${formatPkr(order.total)}</span></div>
    <div><span>Payment</span><span>${paymentLabel(order.paymentMethod)} · ${order.paymentStatus === "UNPAID" ? "Unpaid" : "Paid"}</span></div>
  </div>
  <p class="thanks">Thank you — enjoy your meal!</p>
  <div class="copy-label">Customer copy</div>
  <div class="footer">
    ${store.taxNumber ? `Tax no. ${esc(store.taxNumber)}<br/>` : ""}
    ${store.footer ? `${esc(store.footer)}<br/>` : ""}
    ${cashier ? `Served by ${esc(cashier)} · ` : ""}${esc(order.orderNumber)}
  </div>
  ${printScript()}
</body>
</html>`;
}

export function kitchenTicketHtml(order: Order, store: ReceiptStore) {
  const time = new Date(order.createdAt).toLocaleString("en-PK", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const items = order.items
    .map((i) => {
      const opts = i.optionsLabel ? `<div class="muted">${esc(i.optionsLabel)}</div>` : "";
      const note = i.instructions ? `<div class="muted"><strong>Note:</strong> ${esc(i.instructions)}</div>` : "";
      return `
        <tr>
          <td class="qty">${i.quantity}×</td>
          <td class="name"><strong>${esc(i.nameAtOrder)}</strong>${opts}${note}</td>
        </tr>`;
    })
    .join("");

  const phone = receiptPhone(order.customerPhone);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kitchen ${esc(order.orderNumber)}</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="kitchen-title">★ Kitchen ticket ★</div>
  <div class="center">
    <div class="order-no">${esc(order.orderNumber)}</div>
    <div class="meta">${time}</div>
    <span class="badge">${fulfillmentLabel(order.fulfillmentType)}</span>
    ${order.tableNumber ? `<div class="meta"><strong>Table ${esc(order.tableNumber)}</strong></div>` : ""}
  </div>
  <hr class="rule-bold" />
  <div class="meta">${esc(order.customerName)}${phone ? ` · ${esc(phone)}` : ""}</div>
  ${order.notes ? `<div class="meta" style="margin-top:6px;padding:4px;border:1px dashed #a8a29e;"><strong>Order note:</strong> ${esc(order.notes)}</div>` : ""}
  <table>${items}</table>
  <hr class="rule" />
  <div class="copy-label">Kitchen copy — ${esc(store.name)}</div>
  <div class="footer">${esc(order.orderNumber)} · ${order.items.reduce((n, i) => n + i.quantity, 0)} items</div>
  ${printScript()}
</body>
</html>`;
}

function openPrintWindow(html: string, title: string) {
  const w = window.open("", "_blank", "width=400,height=720");
  if (!w) {
    console.warn("Allow pop-ups to print receipts.");
    return false;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.document.title = title;
  return true;
}

export function printReceipt(order: Order, store: ReceiptStore, options?: PrintReceiptOptions) {
  const copies = options?.copies ?? "both";
  const cashier = options?.cashier;

  if (copies === "customer" || copies === "both") {
    openPrintWindow(customerReceiptHtml(order, store, cashier), `Receipt ${order.orderNumber}`);
  }

  if (copies === "kitchen" || copies === "both") {
    const delay = copies === "both" ? 600 : 0;
    setTimeout(() => {
      openPrintWindow(kitchenTicketHtml(order, store), `Kitchen ${order.orderNumber}`);
    }, delay);
  }

  return true;
}

/** @deprecated use customerReceiptHtml — kept for preview if needed */
export function receiptHtml(order: Order, store: ReceiptStore, cashier?: string) {
  return customerReceiptHtml(order, store, cashier);
}
