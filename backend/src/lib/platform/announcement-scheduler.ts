import { AnnouncementPublishStatus } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { deliverPlatformAnnouncement } from "./broadcast";

let timer: ReturnType<typeof setInterval> | null = null;

export async function publishDueAnnouncements(now = new Date()) {
  const due = await withoutTenant("scheduled announcements", () =>
    basePrisma.platformAnnouncement.findMany({
      where: {
        publishStatus: AnnouncementPublishStatus.SCHEDULED,
        OR: [{ scheduledAt: { lte: now } }, { startsAt: { lte: now } }],
      },
      take: 20,
    })
  );
  for (const row of due) {
    await deliverPlatformAnnouncement(row);
  }
  return { published: due.length };
}

export function startAnnouncementScheduler() {
  if (timer) return;
  const intervalMs = Number(process.env.PLATFORM_ANNOUNCEMENT_INTERVAL_MS || 60_000);
  timer = setInterval(() => {
    void publishDueAnnouncements();
  }, intervalMs);
  timer.unref();
  void publishDueAnnouncements();
}

export function stopAnnouncementScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
