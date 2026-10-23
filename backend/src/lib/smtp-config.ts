import type { StoreSettings } from "@prisma/client";
import nodemailer from "nodemailer";
import { getStoreSettings } from "./settings-data";
import { decryptSecretAtRest } from "./secret-at-rest";

export type ResolvedSmtpConfig = {
  source: "tenant" | "env";
  user: string;
  pass: string;
  host?: string;
  service?: string;
  port: number;
  secure: boolean;
  from?: string;
  replyTo?: string;
};

function envSmtpUser() {
  return (process.env.SMTP_USER || "").trim();
}

function envSmtpPass() {
  return (process.env.SMTP_PASS || "").replace(/\s+/g, "");
}

export function envSmtpConfigured() {
  const host = (process.env.SMTP_HOST || process.env.SMTP_SERVICE || "").trim();
  return Boolean(host && envSmtpUser() && envSmtpPass());
}

function tenantSmtpConfigured(settings: Pick<StoreSettings, "smtpUseCustom" | "smtpUser" | "smtpPassEnc" | "smtpHost" | "smtpService">) {
  if (!settings.smtpUseCustom) return false;
  const user = settings.smtpUser.trim();
  const pass = decryptSecretAtRest(settings.smtpPassEnc);
  const host = settings.smtpHost.trim() || settings.smtpService.trim();
  return Boolean(user && pass && host);
}

export function resolveSmtpFromSettings(settings: StoreSettings): ResolvedSmtpConfig | null {
  if (tenantSmtpConfigured(settings)) {
    const service = settings.smtpService.trim().toLowerCase();
    const port = settings.smtpPort || 587;
    const secure =
      settings.smtpSecure ||
      (port === 465 && !settings.smtpHost.trim());
    return {
      source: "tenant",
      user: settings.smtpUser.trim(),
      pass: decryptSecretAtRest(settings.smtpPassEnc),
      ...(service === "gmail" ? { service: "gmail" } : { host: settings.smtpHost.trim() || "smtp.gmail.com" }),
      port,
      secure,
      from: settings.smtpFrom.trim() || undefined,
      replyTo: settings.smtpReplyTo.trim() || undefined,
    };
  }
  if (!envSmtpConfigured()) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    process.env.SMTP_SECURE === "true" || process.env.SMTP_SECURE === "1"
      ? true
      : process.env.SMTP_SECURE === "false" || process.env.SMTP_SECURE === "0"
        ? false
        : port === 465;
  const service = (process.env.SMTP_SERVICE || "").trim().toLowerCase();
  return {
    source: "env",
    user: envSmtpUser(),
    pass: envSmtpPass(),
    ...(service === "gmail" ? { service: "gmail" } : { host: process.env.SMTP_HOST, port, secure }),
    port,
    secure,
    from: (process.env.SMTP_FROM || process.env.SMTP_FROM_EMAIL || "").trim() || undefined,
    replyTo: (process.env.SMTP_REPLY_TO || "").trim() || undefined,
  };
}

export async function resolveSmtpConfig(): Promise<ResolvedSmtpConfig | null> {
  const settings = await getStoreSettings();
  return resolveSmtpFromSettings(settings);
}

export function createTransportFromConfig(config: ResolvedSmtpConfig) {
  const service = config.service?.toLowerCase();
  return nodemailer.createTransport({
    ...(service === "gmail"
      ? { service: "gmail" }
      : { host: config.host || "localhost", port: config.port, secure: config.secure }),
    auth: { user: config.user, pass: config.pass },
  });
}

export function smtpStatusForSettings(settings: StoreSettings) {
  const tenant = tenantSmtpConfigured(settings);
  const env = envSmtpConfigured();
  if (tenant) {
    return {
      configured: true,
      source: "tenant" as const,
      detail: `Sending as ${settings.smtpUser.trim()} (restaurant SMTP).`,
    };
  }
  if (env) {
    return {
      configured: true,
      source: "env" as const,
      detail: `Sending as ${envSmtpUser()} (server default from backend/.env).`,
    };
  }
  if (settings.smtpUseCustom) {
    return {
      configured: false,
      source: "tenant" as const,
      detail: "Custom SMTP is enabled but host, username, or password is missing.",
    };
  }
  return {
    configured: false,
    source: "none" as const,
    detail: "Order and staff emails log to the server console until SMTP is configured.",
  };
}
