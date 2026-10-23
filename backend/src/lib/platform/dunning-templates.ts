import type { PlatformSettingsData } from "./platform-settings";

export type DunningTemplateKey = "trialEnding" | "invoiceIssued" | "paymentOverdue" | "suspended";

const DEFAULTS: Record<DunningTemplateKey, string> = {
  trialEnding: "Hi {{tenantName}}, your trial ends on {{trialEndsAt}}. Pay {{amountPkr}} PKR to stay on {{planName}}.",
  invoiceIssued:
    "Invoice {{invoiceNumber}} for {{amountPkr}} PKR is due on {{dueAt}}. Period {{periodStart}} – {{periodEnd}}.",
  paymentOverdue:
    "Invoice {{invoiceNumber}} for {{amountPkr}} PKR was due on {{dueAt}}. Please pay to avoid suspension.",
  suspended: "{{tenantName}} is suspended: {{reason}}. Contact {{supportEmail}} to restore access.",
};

export function renderDunningTemplate(
  key: DunningTemplateKey,
  settings: PlatformSettingsData,
  vars: Record<string, string>
) {
  const custom = settings.dunningEmailTemplates?.[key];
  const template = (custom && custom.trim()) || DEFAULTS[key];
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? "");
}
