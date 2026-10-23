import { runPlatformDunningJob } from "./dunning-job";

let timer: ReturnType<typeof setInterval> | null = null;

async function runDunningJobSafely() {
  try {
    await runPlatformDunningJob();
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "JOB_RUNNING") {
      console.warn("[platform dunning] skipped — job already running");
      return;
    }
    console.error("[platform dunning] job failed:", err instanceof Error ? err.message : err);
  }
}

export function startPlatformDunningScheduler() {
  if (timer) return;
  const intervalMs = Number(process.env.PLATFORM_DUNNING_INTERVAL_MS || 6 * 60 * 60 * 1000);
  timer = setInterval(() => {
    void runDunningJobSafely();
  }, intervalMs);
  timer.unref();
  void runDunningJobSafely();
}

export function stopPlatformDunningScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
