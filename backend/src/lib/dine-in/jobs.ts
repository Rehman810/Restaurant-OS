import { ReservationStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { writeAuditLog } from "./audit";
import { enqueueForReservation, processPendingEmailQueue } from "./email-queue";
import { databaseHelpText } from "../db-health";

let dbJobsWarned = false;

export function resetDineInJobDbWarning() {
  dbJobsWarned = false;
}

function logDineInJobDbIssue(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const looksLikeDb =
    /Authentication failed|credentials|ECONNREFUSED|Can't reach database|Connection refused|P1000|P1001/i.test(msg);
  if (looksLikeDb) {
    if (!dbJobsWarned) {
      dbJobsWarned = true;
      console.error(
        "[dine-in jobs] Database unreachable — booking emails, no-shows, and reminders are paused until DATABASE_URL works.\n" +
          databaseHelpText()
      );
    }
    return;
  }
  console.error("[dine-in jobs]", err);
}

export async function runDineInJobs(now = new Date()) {
  try {
    await processPendingEmailQueue(30);
    await markNoShows(now);
    await expireUnconfirmedPending(now);
    await sendReminders(now);
    await sendFollowUps(now);
  } catch (err) {
    logDineInJobDbIssue(err);
  }
}

async function markNoShows(now: Date) {
  const confirmed = await prisma.reservation.findMany({
    where: { status: ReservationStatus.CONFIRMED },
    include: { branch: true, session: true },
  });
  for (const r of confirmed) {
    if (r.session) continue;
    const graceEnd = new Date(r.startsAt.getTime() + r.branch.graceMin * 60_000);
    if (now <= graceEnd) continue;
    await prisma.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.NO_SHOW, noShowAt: now },
    });
    await writeAuditLog({
      branchId: r.branchId,
      action: "reservation.no_show_auto",
      entity: "Reservation",
      entityId: r.id,
    });
    void enqueueForReservation(r.id, "BOOKING_NO_SHOW");
  }
}

async function expireUnconfirmedPending(now: Date) {
  const pending = await prisma.reservation.findMany({
    where: { status: ReservationStatus.PENDING, startsAt: { lt: now } },
  });
  for (const r of pending) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { status: ReservationStatus.CANCELLED, cancelledAt: now },
    });
    await writeAuditLog({
      branchId: r.branchId,
      action: "reservation.expired_unconfirmed",
      entity: "Reservation",
      entityId: r.id,
    });
    void enqueueForReservation(r.id, "BOOKING_CANCELLED");
  }
}

async function sendReminders(now: Date) {
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60_000);
  const windowEnd = new Date(now.getTime() + 2 * 60 * 60_000 + 60_000);
  const due = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.CONFIRMED,
      reminderSentAt: null,
      startsAt: { gte: inTwoHours, lte: windowEnd },
    },
  });
  for (const r of due) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { reminderSentAt: now },
    });
    void enqueueForReservation(r.id, "BOOKING_REMINDER");
  }
}

async function sendFollowUps(now: Date) {
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60_000);
  const due = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.COMPLETED,
      followUpSentAt: null,
      session: { is: { closedAt: { not: null, lte: twoHoursAgo } } },
    },
    include: { session: true },
  });
  for (const r of due) {
    await prisma.reservation.update({
      where: { id: r.id },
      data: { followUpSentAt: now },
    });
    void enqueueForReservation(r.id, "FOLLOW_UP_THANKS");
  }
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startDineInJobScheduler() {
  if (schedulerHandle) return;
  const intervalMs = 60_000;
  schedulerHandle = setInterval(() => {
    void runDineInJobs();
  }, intervalMs);
  void runDineInJobs();
}

export function stopDineInJobScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
