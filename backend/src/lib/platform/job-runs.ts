import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

/** Open runs older than this are treated as abandoned (e.g. API killed mid-job). */
export function platformJobLeaseMs() {
  const fromEnv = Number(process.env.PLATFORM_JOB_LEASE_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 15 * 60 * 1000;
}

export const PLATFORM_SCHEDULED_JOB_KEYS = [
  "platform_billing",
  "platform_dunning",
  "tenant_usage_rollup",
  "tenant_lifecycle",
] as const;

/** Previous API process died without finishing — safe on single-scheduler deployments. */
export async function clearOrphanedPlatformJobRuns(jobKey: string) {
  const now = new Date();
  await withoutTenant(`clear orphaned job runs ${jobKey}`, async () => {
    const open = await basePrisma.platformJobRunHistory.findMany({
      where: { jobKey, finishedAt: null },
      select: { id: true },
    });
    for (const row of open) {
      await basePrisma.platformJobRunHistory.update({
        where: { id: row.id },
        data: {
          finishedAt: now,
          success: false,
          error: "Run orphaned (API restarted)",
        },
      });
    }
  });
}

export async function clearOrphanedPlatformJobsOnBoot() {
  for (const jobKey of PLATFORM_SCHEDULED_JOB_KEYS) {
    await clearOrphanedPlatformJobRuns(jobKey);
  }
}

export async function reclaimAbandonedJobRuns(jobKey: string, leaseMs = platformJobLeaseMs()) {
  const cutoff = new Date(Date.now() - leaseMs);
  const now = new Date();
  await withoutTenant(`reclaim job runs ${jobKey}`, async () => {
    const stale = await basePrisma.platformJobRunHistory.findMany({
      where: { jobKey, finishedAt: null, startedAt: { lt: cutoff } },
      select: { id: true },
    });
    for (const row of stale) {
      await basePrisma.platformJobRunHistory.update({
        where: { id: row.id },
        data: {
          finishedAt: now,
          success: false,
          error: "Run abandoned (lease expired)",
        },
      });
    }
  });
}

export async function assertJobNotRunning(jobKey: string, leaseMs = platformJobLeaseMs()) {
  const running = await withoutTenant("job running check", () =>
    basePrisma.platformJobRunHistory.findFirst({
      where: {
        jobKey,
        finishedAt: null,
        startedAt: { gt: new Date(Date.now() - leaseMs) },
      },
    })
  );
  if (running) {
    throw Object.assign(new Error("This job is already running."), { status: 409, code: "JOB_RUNNING" });
  }
}

/** Starts a job run; returns history row id for completion. */
export async function markJobStarted(jobKey: string, triggeredBy = "scheduler") {
  await reclaimAbandonedJobRuns(jobKey);
  await assertJobNotRunning(jobKey);
  const startedAt = new Date();
  const history = await withoutTenant(`job run start ${jobKey}`, async () => {
    const row = await basePrisma.platformJobRunHistory.create({
      data: { jobKey, startedAt, triggeredBy, success: false },
    });
    await basePrisma.platformJobRun.upsert({
      where: { jobKey },
      create: { jobKey, lastStartedAt: startedAt },
      update: { lastStartedAt: startedAt, lastError: null },
    });
    return row;
  });
  return history.id;
}

export async function markJobFinished(jobKey: string, error?: string | null, historyId?: string) {
  const now = new Date();
  await withoutTenant(`job run finish ${jobKey}`, async () => {
    await basePrisma.platformJobRun.upsert({
      where: { jobKey },
      create: {
        jobKey,
        lastFinishedAt: now,
        lastSuccessAt: error ? undefined : now,
        lastError: error || null,
      },
      update: {
        lastFinishedAt: now,
        ...(error ? { lastError: error } : { lastSuccessAt: now, lastError: null }),
      },
    });
    if (historyId) {
      await basePrisma.platformJobRunHistory.update({
        where: { id: historyId },
        data: { finishedAt: now, success: !error, error: error || null },
      });
      return;
    }
    const open = await basePrisma.platformJobRunHistory.findFirst({
      where: { jobKey, finishedAt: null },
      orderBy: { startedAt: "desc" },
    });
    if (open) {
      await basePrisma.platformJobRunHistory.update({
        where: { id: open.id },
        data: { finishedAt: now, success: !error, error: error || null },
      });
    }
  });
}

export async function loadJobRuns() {
  return withoutTenant("load job runs", () => basePrisma.platformJobRun.findMany({ orderBy: { jobKey: "asc" } }));
}

export async function loadJobRunHistory(jobKey?: string, limit = 20) {
  return withoutTenant("job run history", () =>
    basePrisma.platformJobRunHistory.findMany({
      where: jobKey ? { jobKey } : {},
      orderBy: { startedAt: "desc" },
      take: Math.min(100, Math.max(1, limit)),
    })
  );
}
