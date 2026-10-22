import { runPlatformBillingJob } from "./billing-job";

let timer: ReturnType<typeof setInterval> | null = null;

export function startPlatformBillingScheduler() {
  if (timer) return;
  const intervalMs = Number(process.env.PLATFORM_BILLING_INTERVAL_MS || 60 * 60 * 1000);
  timer = setInterval(() => {
    void runPlatformBillingJob();
  }, intervalMs);
  timer.unref();
  void runPlatformBillingJob();
}

export function stopPlatformBillingScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
