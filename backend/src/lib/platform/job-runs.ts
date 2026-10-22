import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";

export async function markJobStarted(jobKey: string) {
  await withoutTenant(`job run start ${jobKey}`, () =>
    basePrisma.platformJobRun.upsert({
      where: { jobKey },
      create: { jobKey, lastStartedAt: new Date() },
      update: { lastStartedAt: new Date(), lastError: null },
    })
  );
}

export async function markJobFinished(jobKey: string, error?: string | null) {
  const now = new Date();
  await withoutTenant(`job run finish ${jobKey}`, () =>
    basePrisma.platformJobRun.upsert({
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
    })
  );
}

export async function loadJobRuns() {
  return withoutTenant("load job runs", () => basePrisma.platformJobRun.findMany({ orderBy: { jobKey: "asc" } }));
}
