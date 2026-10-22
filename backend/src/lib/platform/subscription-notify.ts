import { Role } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { sendPlatformBroadcastEmail } from "../email";
import { emitOpsNotificationForRestaurant } from "../realtime";

function uniqueEmails(rows: Array<string | null | undefined>) {
  const out = new Set<string>();
  for (const raw of rows) {
    const e = raw?.trim().toLowerCase();
    if (e && e.includes("@")) out.add(e);
  }
  return [...out];
}

export async function notifyTenantBillingEvent(
  restaurantId: string,
  input: { title: string; message: string; severity?: "info" | "warning" | "urgent" }
) {
  const restaurant = await basePrisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { displayName: true, slug: true, ownerEmail: true },
  });
  if (!restaurant) return;

  emitOpsNotificationForRestaurant(restaurantId, {
    id: `subscription-billing-${Date.now()}`,
    kind: "platform_announcement",
    title: input.title,
    message: input.message,
    at: Date.now(),
    severity: input.severity ?? "warning",
    href: "/admin/billing",
  });

  const admins = await basePrisma.user.findMany({
    where: { restaurantId, role: Role.ADMIN, isActive: true },
    select: { email: true },
  });
  const emails = uniqueEmails([restaurant.ownerEmail, ...admins.map((a) => a.email)]);
  for (const to of emails) {
    void sendPlatformBroadcastEmail({
      to,
      tenantName: restaurant.displayName || restaurant.slug,
      title: input.title,
      body: input.message,
      severity: input.severity ?? "warning",
    });
  }
}
