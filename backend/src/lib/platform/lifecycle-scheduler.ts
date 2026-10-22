import { runTenantLifecycleJob } from "./lifecycle-job";

let timer: ReturnType<typeof setInterval> | null = null;

export function startTenantLifecycleScheduler() {
  if (timer) return;
  const intervalMs = Number(process.env.TENANT_LIFECYCLE_INTERVAL_MS || 6 * 60 * 60 * 1000);
  timer = setInterval(() => {
    void runTenantLifecycleJob();
  }, intervalMs);
  timer.unref();
  void runTenantLifecycleJob();
}

export function stopTenantLifecycleScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
