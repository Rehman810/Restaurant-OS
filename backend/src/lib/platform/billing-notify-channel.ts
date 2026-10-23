import { sendPlatformBroadcastEmail } from "../email";

export type BillingNotifyPayload = {
  to: string;
  tenantName: string;
  subject: string;
  body: string;
  severity?: "info" | "warning" | "urgent";
};

export interface BillingNotificationChannel {
  send(payload: BillingNotifyPayload): Promise<void>;
}

export class EmailBillingNotificationChannel implements BillingNotificationChannel {
  async send(payload: BillingNotifyPayload) {
    const sev = payload.severity === "urgent" ? "CRITICAL" : payload.severity === "warning" ? "WARNING" : "INFO";
    await sendPlatformBroadcastEmail({
      to: payload.to,
      tenantName: payload.tenantName,
      title: payload.subject,
      body: payload.body,
      severity: sev,
    });
  }
}

export const defaultBillingNotificationChannel = new EmailBillingNotificationChannel();
