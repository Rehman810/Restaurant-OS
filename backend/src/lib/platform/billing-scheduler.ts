import { runPlatformBillingJob } from "./billing-job";

let timer: ReturnType<typeof setInterval> | null = null;

async function runBillingJobSafely() {
  try {
    await runPlatformBillingJob();
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "JOB_RUNNING") {
      console.warn("[platform billing] skipped — job already running");
      return;
    }
    console.error("[platform billing] job failed:", err instanceof Error ? err.message : err);
  }
}

export function startPlatformBillingScheduler() {
  if (timer) return;
  const intervalMs = Number(process.env.PLATFORM_BILLING_INTERVAL_MS || 60 * 60 * 1000);
  timer = setInterval(() => {
    void runBillingJobSafely();
  }, intervalMs);
  timer.unref();
  void runBillingJobSafely();
}

export function stopPlatformBillingScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
