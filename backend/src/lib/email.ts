import crypto from "crypto";
import nodemailer from "nodemailer";
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

type OrderWithItems = Order & { items: OrderItem[] };

function smtpUser() {
  return (process.env.SMTP_USER || "").trim();
}

function smtpPass() {
  return (process.env.SMTP_PASS || "").replace(/\s+/g, "");
}

function isConfigured() {
  return Boolean((process.env.SMTP_HOST || process.env.SMTP_SERVICE) && smtpUser() && smtpPass());
}

function transporter() {
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1"
      ? true
      : process.env.SMTP_SECURE === "false" || process.env.SMTP_SECURE === "0"
        ? false
        : port === 465;
  const service = (process.env.SMTP_SERVICE || "").trim().toLowerCase();
  return nodemailer.createTransport({
    ...(service === "gmail" ? { service: "gmail" } : { host: process.env.SMTP_HOST, port, secure }),
    auth: {
      user: smtpUser(),
      pass: smtpPass(),
    },
  });
}

async function fromAddress(storeName?: string) {
  const user = smtpUser();
  const name = storeName?.trim() || "Restaurant";
  const configured = (process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || "").trim();

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

function replyToAddress() {
  const replyTo = (process.env.SMTP_REPLY_TO || smtpUser() || "").trim();
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

  if (!isConfigured()) {
    console.log(`[email] (SMTP not configured) To: ${email} | ${opts.subject}`);
    return false;
  }

  const from = await fromAddress(opts.storeName);
  const domain = messageDomain(from);
  const headers: Record<string, string> = {
    "X-Mailer": PRODUCT_NAME.replace(/\s+/g, "-"),
    "X-Priority": "3",
    Precedence: "auto",
    "X-Auto-Response-Suppress": "All",
  };

  if (!opts.transactional) {
    headers["List-Unsubscribe"] = `<mailto:${replyToAddress() || `noreply@${domain}`}?subject=unsubscribe>`;
  }

  try {
    await transporter().sendMail({
      from,
      to: email,
      replyTo: replyToAddress(),
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
        "[email] Gmail rejected the login. Use the Gmail address in SMTP_USER and a 16-character App Password in SMTP_PASS."
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
