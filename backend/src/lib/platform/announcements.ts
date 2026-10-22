import { AnnouncementAudience, TenantStatus, type PlatformAnnouncement } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { prisma } from "../prisma";
import { getRestaurantId } from "../restaurant-context";
import { withoutTenant } from "../restaurant-context";

export async function listPlatformAnnouncements() {
  return withoutTenant("list announcements", () =>
    basePrisma.platformAnnouncement.findMany({ orderBy: { startsAt: "desc" }, take: 200 })
  );
}

export async function createPlatformAnnouncement(input: {
  title: string;
  body?: string;
  severity?: PlatformAnnouncement["severity"];
  audience?: AnnouncementAudience;
  audiencePlanSlug?: string | null;
  audienceStatus?: TenantStatus | null;
  audienceTenantIds?: string[];
  startsAt: Date;
  endsAt?: Date | null;
  dismissible?: boolean;
}) {
  return withoutTenant("create announcement", () =>
    basePrisma.platformAnnouncement.create({
      data: {
        title: input.title.trim(),
        body: input.body?.trim() || "",
        severity: input.severity,
        audience: input.audience ?? AnnouncementAudience.ALL,
        audiencePlanSlug: input.audiencePlanSlug || null,
        audienceStatus: input.audienceStatus || null,
        audienceTenantIds: input.audienceTenantIds ?? [],
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        dismissible: input.dismissible ?? true,
      },
    })
  );
}

function announcementMatchesTenant(
  row: PlatformAnnouncement,
  ctx: { restaurantId: string; status: TenantStatus; planSlug: string | null }
) {
  if (row.audience === AnnouncementAudience.ALL) return true;
  if (row.audience === AnnouncementAudience.PLAN) {
    return row.audiencePlanSlug && ctx.planSlug && row.audiencePlanSlug === ctx.planSlug;
  }
  if (row.audience === AnnouncementAudience.STATUS) {
    return row.audienceStatus && row.audienceStatus === ctx.status;
  }
  if (row.audience === AnnouncementAudience.TENANTS) {
    return row.audienceTenantIds.includes(ctx.restaurantId);
  }
  return false;
}

export async function activeAnnouncementsForTenant() {
  const restaurantId = getRestaurantId();
  const now = new Date();
  const [restaurant, subscription, dismissed] = await Promise.all([
    prisma.restaurant.findUnique({ where: { id: restaurantId }, select: { status: true } }),
    prisma.subscription.findFirst({
      include: { plan: { select: { slug: true } } },
    }),
    prisma.announcementDismissal.findMany({
      where: { restaurantId },
      select: { announcementId: true },
    }),
  ]);
  if (!restaurant) return [];
  const dismissedIds = new Set(dismissed.map((d) => d.announcementId));
  const rows = await withoutTenant("active announcements", () =>
    basePrisma.platformAnnouncement.findMany({
      where: {
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
      orderBy: { startsAt: "desc" },
      take: 20,
    })
  );
  const ctx = {
    restaurantId,
    status: restaurant.status,
    planSlug: subscription?.plan?.slug ?? null,
  };
  return rows
    .filter((row) => announcementMatchesTenant(row, ctx))
    .filter((row) => !(dismissedIds.has(row.id) && row.dismissible))
    .map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      severity: row.severity,
      dismissible: row.dismissible,
    }));
}

export async function dismissAnnouncement(announcementId: string) {
  const restaurantId = getRestaurantId();
  await prisma.announcementDismissal.upsert({
    where: { announcementId_restaurantId: { announcementId, restaurantId } },
    create: { announcementId, restaurantId },
    update: { dismissedAt: new Date() },
  });
}
