import { markJobFinished, markJobStarted } from "./job-runs";
import { runSubscriptionLifecycleBatch } from "./subscription-lifecycle";

const JOB_KEY = "platform_billing";

export async function runPlatformBillingJob(now = new Date()) {
  await markJobStarted(JOB_KEY);
  try {
    const out = await runSubscriptionLifecycleBatch(now);
    await markJobFinished(JOB_KEY, null);
    return out ?? { skipped: true as const };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markJobFinished(JOB_KEY, message);
    throw err;
  }
}
