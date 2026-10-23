import type { StoreSettings } from "@prisma/client";
import { getVapidPublicKey } from "./web-push";
import { envSmtpConfigured, smtpStatusForSettings } from "./smtp-config";

function whatsappConfigured() {
  const flag = (process.env.WHATSAPP_ENABLED || "true").toLowerCase();
  const enabled = flag !== "false" && flag !== "0";
  const creds = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  return { enabled, configured: enabled && creds };
}

export type IntegrationStatusItem = {
  id: string;
  label: string;
  configured: boolean;
  detail: string;
  envVars: string[];
};

export function getIntegrationsStatus(settings?: StoreSettings) {
  const wa = whatsappConfigured();
  const vapidPublic = getVapidPublicKey();
  const vapidPrivate = Boolean(process.env.VAPID_PRIVATE_KEY?.trim());
  const smtp = settings ? smtpStatusForSettings(settings) : { configured: envSmtpConfigured(), detail: "", source: "env" as const };

  const items: IntegrationStatusItem[] = [
    {
      id: "smtp",
      label: "Email (SMTP)",
      configured: smtp.configured,
      detail: smtp.detail,
      envVars: settings?.smtpUseCustom
        ? ["Restaurant SMTP below (host, user, password)"]
        : ["SMTP_HOST or SMTP_SERVICE", "SMTP_USER", "SMTP_PASS", "or enable restaurant SMTP below"],
    },
    {
      id: "vapid",
      label: "Web push (VAPID)",
      configured: Boolean(vapidPublic && vapidPrivate),
      detail: vapidPublic
        ? "Staff and customer push can be enabled in settings."
        : "Generate keys with web-push and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.",
      envVars: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"],
    },
    {
      id: "google-places",
      label: "Google Places API",
      configured: Boolean((process.env.GOOGLE_PLACES_API_KEY || "").trim()),
      detail: "Required to pull live Google reviews when a Place ID is saved below.",
      envVars: ["GOOGLE_PLACES_API_KEY"],
    },
    {
      id: "whatsapp",
      label: "WhatsApp Cloud API",
      configured: wa.configured,
      detail: wa.enabled
        ? wa.configured
          ? "Templates and Meta credentials are present."
          : "WHATSAPP_ENABLED is on but token or phone number id is missing."
        : "Disabled via WHATSAPP_ENABLED=false.",
      envVars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TEMPLATE_*"],
    },
  ];

  return { items, generatedAt: new Date().toISOString() };
}
