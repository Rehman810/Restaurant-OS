import { runTenantUsageRollupJob } from "./usage-rollup-job";

let timer: ReturnType<typeof setInterval> | null = null;

export function startUsageRollupScheduler() {
  if (timer) return;
  const intervalMs = Number(process.env.USAGE_ROLLUP_INTERVAL_MS || 6 * 60 * 60 * 1000);
  timer = setInterval(() => {
    void runTenantUsageRollupJob();
  }, intervalMs);
  timer.unref();
  void runTenantUsageRollupJob();
}

export function stopUsageRollupScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
