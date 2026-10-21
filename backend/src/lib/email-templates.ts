import type { Order, OrderItem } from "@prisma/client";
import { POWERED_BY_NAME, POWERED_BY_URL, PRODUCT_NAME } from "./branding";
import { formatMoney, type MoneySettings } from "./money";

type OrderWithItems = Order & { items: OrderItem[] };

export type EmailBrand = {
  storeName: string;
} & MoneySettings;

const C = {
  brand: "#ea580c",
  brandDark: "#c2410c",
  cream: "#fffaf5",
  ink: "#1c1917",
  stone: "#57534e",
  muted: "#78716c",
  border: "#fed7aa",
  white: "#ffffff",
  success: "#15803d",
  successBg: "#f0fdf4",
  warn: "#b45309",
  warnBg: "#fffbeb",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  info: "#1d4ed8",
  infoBg: "#eff6ff",
};

export function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPkr(amount: number | string, settings?: MoneySettings) {
  return formatMoney(amount, settings);
}

function stripTags(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type BadgeTone = "brand" | "success" | "warn" | "danger" | "info";

const badgeColors: Record<BadgeTone, { bg: string; fg: string }> = {
  brand: { bg: C.brand, fg: C.white },
  success: { bg: C.successBg, fg: C.success },
  warn: { bg: C.warnBg, fg: C.warn },
  danger: { bg: C.dangerBg, fg: C.danger },
  info: { bg: C.infoBg, fg: C.info },
};

type LayoutOptions = {
  brand: EmailBrand;
  preheader?: string;
  eyebrow?: string;
  title: string;
  badge?: { label: string; tone?: BadgeTone };
  body: string;
  cta?: { label: string; url: string };
  footerNote?: string;
};

export function renderEmail(opts: LayoutOptions): { html: string; text: string } {
  const storeName = esc(opts.brand.storeName);
  const badge = opts.badge
    ? `<span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;background:${badgeColors[opts.badge.tone || "brand"].bg};color:${badgeColors[opts.badge.tone || "brand"].fg}">${esc(opts.badge.label)}</span>`
    : "";

  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0"><tr><td style="border-radius:12px;background:${C.brand}"><a href="${esc(opts.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:${C.white};text-decoration:none">${esc(opts.cta.label)}</a></td></tr></table>`
    : "";

  const preheader = opts.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${esc(opts.preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";

  const powered = `<p style="margin:16px 0 0;font-size:11px;color:${C.muted}">Powered by <a href="${esc(POWERED_BY_URL)}" style="color:${C.brand};text-decoration:none;font-weight:600">${esc(POWERED_BY_NAME)}</a></p>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f4;-webkit-text-size-adjust:100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
          <tr>
            <td style="padding:0 8px 16px;text-align:center">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto">
                <tr>
                  <td style="width:40px;height:40px;border-radius:999px;background:${C.brand};text-align:center;vertical-align:middle;font-size:18px;line-height:40px">🔥</td>
                  <td style="padding-left:12px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${C.ink};letter-spacing:-0.02em">${storeName}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${C.white};border:1px solid ${C.border};border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(28,25,23,0.06)">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="height:4px;background:linear-gradient(90deg,${C.brandDark},${C.brand},#fb923c)"></td>
                </tr>
                <tr>
                  <td style="padding:28px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
                    ${opts.eyebrow ? `<p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${C.brand}">${esc(opts.eyebrow)}</p>` : ""}
                    ${badge ? `<p style="margin:0 0 12px">${badge}</p>` : ""}
                    <h1 style="margin:0;font-size:26px;line-height:1.25;font-weight:800;color:${C.ink};letter-spacing:-0.02em">${esc(opts.title)}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${C.stone}">
                    ${opts.body}
                    ${cta}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 8px 0;text-align:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:${C.muted}">
              <p style="margin:0 0 8px;font-weight:600;color:${C.stone}">${storeName}</p>
              <p style="margin:0">${opts.footerNote || "Thank you for your order."}</p>
              <p style="margin:12px 0 0">Questions? Reply to this email or contact the restaurant.</p>
              ${powered}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    opts.brand.storeName,
    "—".repeat(24),
    opts.title,
    "",
    stripTags(opts.body),
    opts.cta ? `\n${opts.cta.label}: ${opts.cta.url}` : "",
    "",
    opts.footerNote || "Thank you for your order.",
    `Powered by ${POWERED_BY_NAME} — ${POWERED_BY_URL}`,
  ]
    .filter(Boolean)
    .join("\n");

  return { html, text };
}

export function orderItemsBlock(items: OrderItem[]) {
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:14px;color:${C.ink}">${i.quantity}× ${esc(i.nameAtOrder)}</td>
        <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:14px;color:${C.ink};text-align:right;white-space:nowrap">${formatPkr(Number(i.priceAtOrder) * i.quantity)}</td>
      </tr>`
    )
    .join("");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;border-collapse:collapse">
    <tr>
      <td colspan="2" style="padding:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted}">Your order</td>
    </tr>
    ${rows}
  </table>`;
}

export function infoCard(label: string, value: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;background:${C.cream};border:1px solid ${C.border};border-radius:14px">
    <tr>
      <td style="padding:14px 16px">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.muted}">${esc(label)}</p>
        <p style="margin:0;font-size:14px;font-weight:600;color:${C.ink}">${value}</p>
      </td>
    </tr>
  </table>`;
}

export function totalRow(label: string, amount: number | string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0">
    <tr>
      <td style="font-size:15px;font-weight:700;color:${C.ink}">${esc(label)}</td>
      <td style="font-size:18px;font-weight:800;color:${C.brand};text-align:right">${formatPkr(amount)}</td>
    </tr>
  </table>`;
}

function fulfillmentLabel(order: OrderWithItems) {
  return order.fulfillmentType === "PICKUP" ? "Takeaway" : "Delivery";
}

export function orderPlacedEmail(brand: EmailBrand, order: OrderWithItems, autoConfirmed: boolean) {
  const title = autoConfirmed ? "Order confirmed" : "We received your order";
  const intro = autoConfirmed
    ? `Hi ${esc(order.customerName)}, your order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong> is confirmed. The kitchen is getting started.`
    : `Hi ${esc(order.customerName)}, we received order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong>. Our team will call <strong style="color:${C.ink}">${esc(order.customerPhone)}</strong> shortly to verify details before cooking.`;

  return renderEmail({
    brand,
    preheader: autoConfirmed
      ? `Order ${order.orderNumber} confirmed — we're cooking now.`
      : `Order ${order.orderNumber} received — we'll call to confirm.`,
    eyebrow: "Order update",
    title,
    badge: { label: autoConfirmed ? "Confirmed" : "Pending call", tone: autoConfirmed ? "success" : "warn" },
    body: `
      <p style="margin:0">${intro}</p>
      ${orderItemsBlock(order.items)}
      ${totalRow("Total", Number(order.total))}
      ${infoCard(fulfillmentLabel(order), esc(order.deliveryAddress))}
    `,
    footerNote: "Track your order anytime from our website.",
  });
}

export function orderConfirmedEmail(brand: EmailBrand, order: OrderWithItems) {
  return renderEmail({
    brand,
    preheader: `Order ${order.orderNumber} is confirmed after verification.`,
    eyebrow: "Order update",
    title: "You're all set",
    badge: { label: "Confirmed", tone: "success" },
    body: `
      <p style="margin:0">Hi ${esc(order.customerName)}, order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong> is confirmed. The kitchen is preparing your food now.</p>
      ${totalRow("Total", Number(order.total))}
      ${infoCard(fulfillmentLabel(order), esc(order.deliveryAddress))}
    `,
  });
}

export function orderPreparingEmail(brand: EmailBrand, order: OrderWithItems) {
  return renderEmail({
    brand,
    preheader: `Order ${order.orderNumber} is being prepared in the kitchen.`,
    eyebrow: "Kitchen",
    title: "We're cooking your order",
    badge: { label: "Preparing", tone: "brand" },
    body: `<p style="margin:0">Hi ${esc(order.customerName)}, the kitchen has started on order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong>. We'll notify you when it's ready.</p>`,
  });
}

export function orderOnTheWayEmail(brand: EmailBrand, order: OrderWithItems) {
  const takeaway = order.fulfillmentType === "PICKUP";
  return renderEmail({
    brand,
    preheader: takeaway
      ? `Order ${order.orderNumber} is ready for pickup.`
      : `Order ${order.orderNumber} is on the way to you.`,
    eyebrow: takeaway ? "Pickup" : "Delivery",
    title: takeaway ? "Ready for pickup" : "On the way",
    badge: { label: takeaway ? "Ready now" : "Out for delivery", tone: "info" },
    body: `
      <p style="margin:0">Hi ${esc(order.customerName)}, order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong> ${takeaway ? "is ready to collect." : "is heading your way."}</p>
      ${infoCard(takeaway ? "Pickup at" : "Deliver to", esc(order.deliveryAddress))}
    `,
  });
}

export function orderDeliveredEmail(brand: EmailBrand, order: OrderWithItems) {
  return renderEmail({
    brand,
    preheader: `Order ${order.orderNumber} delivered — enjoy your meal!`,
    eyebrow: "Delivered",
    title: "Enjoy your meal",
    badge: { label: "Delivered", tone: "success" },
    body: `
      <p style="margin:0">Hi ${esc(order.customerName)}, order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong> has been delivered. Thank you for choosing ${esc(brand.storeName)}!</p>
      ${totalRow("Total paid", Number(order.total))}
    `,
    footerNote: "Loved it? Order again anytime from our menu.",
  });
}

export function orderCancelledEmail(brand: EmailBrand, order: OrderWithItems) {
  return renderEmail({
    brand,
    preheader: `Order ${order.orderNumber} has been cancelled.`,
    eyebrow: "Order update",
    title: "Order cancelled",
    badge: { label: "Cancelled", tone: "danger" },
    body: `<p style="margin:0">Hi ${esc(order.customerName)}, order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong> has been cancelled. If this wasn't you, please contact the restaurant.</p>`,
  });
}

export function newOrderStaffEmail(brand: EmailBrand, order: OrderWithItems) {
  return renderEmail({
    brand,
    preheader: `New order ${order.orderNumber} — ${order.customerName}`,
    eyebrow: PRODUCT_NAME,
    title: "New order",
    badge: { label: "Action needed", tone: "warn" },
    body: `
      <p style="margin:0"><strong style="color:${C.ink}">${esc(order.orderNumber)}</strong></p>
      ${infoCard("Customer", `${esc(order.customerName)} · ${esc(order.customerPhone)}`)}
      ${infoCard(fulfillmentLabel(order), esc(order.deliveryAddress))}
      ${orderItemsBlock(order.items)}
      ${totalRow("Total", Number(order.total))}
    `,
    footerNote: `Open ${PRODUCT_NAME} to accept and manage this order.`,
  });
}

export function riderAssignedEmail(brand: EmailBrand, riderName: string, order: OrderWithItems) {
  return renderEmail({
    brand,
    preheader: `Delivery assigned: ${order.orderNumber}`,
    eyebrow: "Rider",
    title: "New delivery assigned",
    badge: { label: "Assigned", tone: "info" },
    body: `
      <p style="margin:0">Hi ${esc(riderName)}, you've been assigned order <strong style="color:${C.ink}">${esc(order.orderNumber)}</strong>.</p>
      ${infoCard("Customer", `${esc(order.customerName)} · ${esc(order.customerPhone)}`)}
      ${infoCard("Address", esc(order.deliveryAddress))}
    `,
    footerNote: "Open the rider app to update delivery status.",
  });
}

export function passwordResetEmail(brand: EmailBrand, name: string, resetUrl: string) {
  return renderEmail({
    brand,
    preheader: `Reset your ${brand.storeName} password.`,
    eyebrow: "Account security",
    title: "Reset your password",
    badge: { label: "Security", tone: "brand" },
    body: `
      <p style="margin:0">Hi ${esc(name)}, we received a request to reset your password. Tap the button below — this link expires in <strong>1 hour</strong>.</p>
      <p style="margin:16px 0 0;font-size:13px;color:${C.muted}">If you didn't request this, you can safely ignore this email.</p>
    `,
    cta: { label: "Reset password", url: resetUrl },
  });
}

export function staffInviteEmail(brand: EmailBrand, name: string, inviteUrl: string, role: string) {
  return renderEmail({
    brand,
    preheader: `Set up your ${role} account for ${brand.storeName}.`,
    eyebrow: "Staff invite",
    title: "You're invited",
    badge: { label: role, tone: "brand" },
    body: `
      <p style="margin:0">Hi ${esc(name)}, use the secure link below to set your password and activate your account. This link expires in 7 days and works once.</p>
      ${infoCard("Role", esc(role))}
    `,
    cta: { label: "Set password", url: inviteUrl },
    footerNote: "If you weren't expecting this invite, contact your store admin.",
  });
}

export function staffWelcomeEmail(
  brand: EmailBrand,
  name: string,
  email: string,
  role: string,
  temporaryPassword?: string
) {
  const creds = temporaryPassword
    ? `${infoCard("Sign-in email", esc(email))}${infoCard("Temporary password", `<span style="font-family:ui-monospace,monospace;letter-spacing:0.04em">${esc(temporaryPassword)}</span>`)}`
    : infoCard("Sign-in email", esc(email));

  return renderEmail({
    brand,
    preheader: `Your ${role} account for ${brand.storeName}.`,
    eyebrow: "Staff account",
    title: "Welcome to the team",
    badge: { label: role, tone: "brand" },
    body: `
      <p style="margin:0">Hi ${esc(name)}, your staff account is ready. Sign in with the details below and change your password after first login if you were given a temporary one.</p>
      ${infoCard("Your role", esc(role))}
      ${creds}
    `,
    footerNote: "Keep your login details private. Contact admin if you need help.",
  });
}
