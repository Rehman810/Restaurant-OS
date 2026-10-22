import {
  AnnouncementAudience,
  AnnouncementSeverity,
  Role,
  type PlatformAnnouncement,
} from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { emitOpsNotificationForRestaurant } from "../realtime";
import { sendPlatformBroadcastEmail } from "../email";

type TenantTarget = {
  id: string;
  displayName: string;
  slug: string;
  ownerEmail: string;
  status: string;
  planSlug: string | null;
};

function severityToOps(severity: AnnouncementSeverity): "info" | "warning" | "urgent" {
  if (severity === "CRITICAL") return "urgent";
  if (severity === "WARNING") return "warning";
  return "info";
}

function matchesAudience(row: PlatformAnnouncement, t: TenantTarget) {
  if (row.audience === AnnouncementAudience.ALL) return true;
  if (row.audience === AnnouncementAudience.PLAN) {
    return row.audiencePlanSlug && t.planSlug && row.audiencePlanSlug === t.planSlug;
  }
  if (row.audience === AnnouncementAudience.STATUS) {
    return row.audienceStatus && row.audienceStatus === t.status;
  }
  if (row.audience === AnnouncementAudience.TENANTS) {
    return row.audienceTenantIds.includes(t.id);
  }
  return false;
}

async function loadTenantTargets(): Promise<TenantTarget[]> {
  const rows = await withoutTenant("broadcast targets", () =>
    basePrisma.restaurant.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: {
        id: true,
        displayName: true,
        slug: true,
        ownerEmail: true,
        status: true,
        subscriptions: {
          take: 1,
          orderBy: { updatedAt: "desc" },
          select: { plan: { select: { slug: true } } },
        },
      },
    })
  );
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    slug: r.slug,
    ownerEmail: r.ownerEmail || "",
    status: r.status,
    planSlug: r.subscriptions[0]?.plan?.slug ?? null,
  }));
}

async function recipientEmails(restaurantId: string, ownerEmail: string) {
  const emails = new Set<string>();
  const owner = ownerEmail.trim().toLowerCase();
  if (owner && owner.includes("@")) emails.add(owner);
  const admins = await withoutTenant("broadcast admin emails", () =>
    basePrisma.user.findMany({
      where: { restaurantId, role: Role.ADMIN, isActive: true },
      select: { email: true },
    })
  );
  for (const u of admins) {
    const e = u.email.trim().toLowerCase();
    if (e && e.includes("@")) emails.add(e);
  }
  return [...emails];
}

export async function deliverPlatformAnnouncement(
  row: PlatformAnnouncement,
  opts: { email?: boolean; inApp?: boolean } = {}
) {
  const sendEmail = opts.email !== false;
  const inApp = opts.inApp !== false;
  const targets = (await loadTenantTargets()).filter((t) => matchesAudience(row, t));
  const severity = severityToOps(row.severity);

  for (const t of targets) {
    if (inApp) {
      emitOpsNotificationForRestaurant(t.id, {
        id: `platform-announcement-${row.id}`,
        kind: "platform_announcement",
        title: row.title,
        message: row.body || row.title,
        at: Date.now(),
        severity,
        href: "/admin",
        meta: { announcementId: row.id },
      });
    }
    if (sendEmail) {
      const emails = await recipientEmails(t.id, t.ownerEmail);
      for (const to of emails) {
        void sendPlatformBroadcastEmail({
          to,
          tenantName: t.displayName || t.slug,
          title: row.title,
          body: row.body,
          severity: row.severity,
        });
      }
    }
  }
  return { tenantCount: targets.length };
}

export async function deliverMaintenanceBroadcast(message: string, active: boolean) {
  if (!active) return { tenantCount: 0 };
  const targets = await loadTenantTargets();
  const body = message.trim() || "Scheduled maintenance is in progress.";
  for (const t of targets) {
    emitOpsNotificationForRestaurant(t.id, {
      id: `platform-maintenance-${Date.now()}`,
      kind: "platform_maintenance",
      title: "Platform maintenance",
      message: body,
      at: Date.now(),
      severity: "warning",
      href: "/admin",
    });
    const emails = await recipientEmails(t.id, t.ownerEmail);
    for (const to of emails) {
      void sendPlatformBroadcastEmail({
        to,
        tenantName: t.displayName || t.slug,
        title: "Platform maintenance in progress",
        body,
        severity: "WARNING",
      });
    }
  }
  return { tenantCount: targets.length };
}
