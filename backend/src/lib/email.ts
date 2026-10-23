import crypto from "crypto";
import type { Order, OrderItem } from "@prisma/client";
import { getEmailBranding, PRODUCT_NAME } from "./branding";
import {
  newOrderStaffEmail,
  orderCancelledEmail,
  orderConfirmedEmail,
  orderDeliveredEmail,
  orderOnTheWayEmail,
  orderPlacedEmail,
  orderPreparingEmail,
  passwordResetEmail,
  riderAssignedEmail,
  staffWelcomeEmail,
  staffInviteEmail,
} from "./email-templates";
import { createTransportFromConfig, resolveSmtpConfig, type ResolvedSmtpConfig } from "./smtp-config";

type OrderWithItems = Order & { items: OrderItem[] };

async function fromAddress(config: ResolvedSmtpConfig, storeName?: string) {
  const user = config.user;
  const name = storeName?.trim() || "Restaurant";
  const configured = (config.from || "").trim();

  if (!configured) {
    return user ? `${name} <${user}>` : `${name} <orders@restaurant.local>`;
  }

  const match = configured.match(/<([^>]+)>/);
  const configuredEmail = (match?.[1] || configured).trim().toLowerCase();

  if (user && configuredEmail !== user.toLowerCase()) {
    return `${name} <${user}>`;
  }

  return configured.includes("<") ? configured.replace(/^[^<]+/, `${name} `) : `${name} <${configured}>`;
}

function replyToAddress(config: ResolvedSmtpConfig) {
  const replyTo = (config.replyTo || config.user || "").trim();
  return replyTo.includes("@") ? replyTo : undefined;
}

function messageDomain(from: string) {
  const match = from.match(/<([^>]+)>/);
  const email = (match?.[1] || from).trim();
  return email.split("@")[1] || "restaurant.local";
}

type SendOptions = {
  to: string;
  subject: string;
  html: string;
  text: string;
  storeName?: string;
  transactional?: boolean;
};

async function sendMail(opts: SendOptions) {
  const email = opts.to.trim().toLowerCase();
  if (!email || !email.includes("@")) return false;

  const config = await resolveSmtpConfig();
  if (!config) {
    console.log(`[email] (SMTP not configured) To: ${email} | ${opts.subject}`);
    return false;
  }

  const from = await fromAddress(config, opts.storeName);
  const domain = messageDomain(from);
  const headers: Record<string, string> = {
    "X-Mailer": PRODUCT_NAME.replace(/\s+/g, "-"),
    "X-Priority": "3",
    Precedence: "auto",
    "X-Auto-Response-Suppress": "All",
  };

  if (!opts.transactional) {
    headers["List-Unsubscribe"] = `<mailto:${replyToAddress(config) || `noreply@${domain}`}?subject=unsubscribe>`;
  }

  try {
    await createTransportFromConfig(config).sendMail({
      from,
      to: email,
      replyTo: replyToAddress(config),
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      headers,
      messageId: `<${crypto.randomUUID()}@${domain}>`,
      encoding: "utf-8",
    });
    return true;
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: string }).code) : "";
    if (code === "EAUTH") {
      console.error(
        "[email] SMTP rejected the login. Check username and app password for this restaurant or server SMTP."
      );
    } else {
      console.error("[email] send failed:", err);
    }
    return false;
  }
}

export async function sendEmail(to: string, subject: string, html: string, text?: string) {
  const brand = await getEmailBranding();
  return sendMail({
    to,
    subject,
    html,
    text: text || "Please view this email in an HTML-capable client.",
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendEmailWithConfig(
  config: ResolvedSmtpConfig,
  to: string,
  subject: string,
  html: string,
  text: string,
  storeName?: string
) {
  const email = to.trim().toLowerCase();
  if (!email || !email.includes("@")) return false;
  const from = await fromAddress(config, storeName);
  try {
    await createTransportFromConfig(config).sendMail({
      from,
      to: email,
      replyTo: replyToAddress(config),
      subject,
      html,
      text,
    });
    return true;
  } catch {
    return false;
  }
}

async function customerOrderEmailsEnabled() {
  const brand = await getEmailBranding();
  return brand.emailNotifyCustomer;
}

export async function sendOrderPlacedEmail(order: OrderWithItems, autoConfirmed: boolean) {
  if (!order.customerEmail) return;
  if (!(await customerOrderEmailsEnabled())) return;
  const brand = await getEmailBranding();
  const { html, text } = orderPlacedEmail({ storeName: brand.storeName }, order, autoConfirmed);
  await sendMail({
    to: order.customerEmail,
    subject: autoConfirmed
      ? `Order ${order.orderNumber} confirmed — ${brand.storeName}`
      : `Order ${order.orderNumber} received — we'll call to confirm`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendOrderConfirmedEmail(order: OrderWithItems) {
  if (!order.customerEmail) return;
  if (!(await customerOrderEmailsEnabled())) return;
  const brand = await getEmailBranding();
  const { html, text } = orderConfirmedEmail({ storeName: brand.storeName }, order);
  await sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} confirmed — ${brand.storeName}`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendOrderDeliveredEmail(order: OrderWithItems) {
  if (!order.customerEmail) return;
  if (!(await customerOrderEmailsEnabled())) return;
  const brand = await getEmailBranding();
  const { html, text } = orderDeliveredEmail({ storeName: brand.storeName }, order);
  await sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} delivered — thank you!`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendOrderPreparingEmail(order: OrderWithItems) {
  if (!order.customerEmail) return;
  if (!(await customerOrderEmailsEnabled())) return;
  const brand = await getEmailBranding();
  const { html, text } = orderPreparingEmail({ storeName: brand.storeName }, order);
  await sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} is being prepared`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendOrderOnTheWayEmail(order: OrderWithItems) {
  if (!order.customerEmail) return;
  if (!(await customerOrderEmailsEnabled())) return;
  const takeaway = order.fulfillmentType === "PICKUP";
  const brand = await getEmailBranding();
  const { html, text } = orderOnTheWayEmail({ storeName: brand.storeName }, order);
  await sendMail({
    to: order.customerEmail,
    subject: takeaway
      ? `Order ${order.orderNumber} is ready for pickup`
      : `Order ${order.orderNumber} is on the way`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendOrderCancelledEmail(order: OrderWithItems) {
  if (!order.customerEmail) return;
  if (!(await customerOrderEmailsEnabled())) return;
  const brand = await getEmailBranding();
  const { html, text } = orderCancelledEmail({ storeName: brand.storeName }, order);
  await sendMail({
    to: order.customerEmail,
    subject: `Order ${order.orderNumber} cancelled`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendNewOrderStaffEmail(order: OrderWithItems, adminEmails: string[]) {
  const brand = await getEmailBranding();
  const { html, text } = newOrderStaffEmail({ storeName: brand.storeName }, order);
  await Promise.all(
    adminEmails.map((email) =>
      sendMail({
        to: email,
        subject: `New order ${order.orderNumber} — ${PRODUCT_NAME}`,
        html,
        text,
        storeName: brand.storeName,
        transactional: true,
      })
    )
  );
}

export async function sendRiderAssignedEmail(
  riderEmail: string | null | undefined,
  riderName: string,
  order: OrderWithItems
) {
  if (!riderEmail) return;
  const brand = await getEmailBranding();
  if (!brand.emailNotifyRider) return;
  const { html, text } = riderAssignedEmail({ storeName: brand.storeName }, riderName, order);
  await sendMail({
    to: riderEmail,
    subject: `Delivery ${order.orderNumber} assigned to you`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendPasswordResetEmail(email: string, name: string, resetUrl: string) {
  const brand = await getEmailBranding();
  const { html, text } = passwordResetEmail({ storeName: brand.storeName }, name, resetUrl);
  await sendMail({
    to: email,
    subject: `Reset your ${brand.storeName} password`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendStaffInviteEmail(email: string, name: string, role: string, inviteUrl: string) {
  const brand = await getEmailBranding();
  const { html, text } = staffInviteEmail({ storeName: brand.storeName }, name, inviteUrl, role);
  await sendMail({
    to: email,
    subject: `Set up your ${brand.storeName} staff account`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendStaffWelcomeEmail(
  email: string,
  name: string,
  role: string,
  temporaryPassword?: string
) {
  const brand = await getEmailBranding();
  const { html, text } = staffWelcomeEmail(
    { storeName: brand.storeName },
    name,
    email,
    role,
    temporaryPassword
  );
  await sendMail({
    to: email,
    subject: `Your ${brand.storeName} staff account`,
    html,
    text,
    storeName: brand.storeName,
    transactional: true,
  });
}

export async function sendPlatformBroadcastEmail(input: {
  to: string;
  tenantName: string;
  title: string;
  body: string;
  severity: string;
}) {
  const title = input.title.trim();
  const body = input.body.trim();
  const tenant = input.tenantName.trim() || "your restaurant";
  const subject = `Restaurant OS — ${title}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;max-width:520px">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#64748b">Restaurant OS operator broadcast</p>
      <h1 style="font-size:20px;margin:12px 0 8px">${title}</h1>
      <p style="margin:0 0 16px;color:#334155">${body || title}</p>
      <p style="font-size:13px;color:#64748b;margin:0">Sent to <strong>${tenant}</strong>. Open your admin dashboard to read this in notifications.</p>
    </div>`;
  const text = `Restaurant OS broadcast for ${tenant}\n\n${title}\n\n${body || title}`;
  await sendMail({
    to: input.to,
    subject,
    html,
    text,
    storeName: PRODUCT_NAME,
    transactional: true,
  });
}
