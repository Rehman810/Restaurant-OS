import { runPlatformBillingJob } from "./billing-job";
import { runPlatformDunningJob } from "./dunning-job";
import { runTenantLifecycleJob } from "./lifecycle-job";
import { runTenantUsageRollupJob } from "./usage-rollup-job";

export const PLATFORM_JOB_KEYS = [
  "platform_billing",
  "tenant_lifecycle",
  "tenant_usage_rollup",
  "platform_dunning",
] as const;

export type PlatformJobKey = (typeof PLATFORM_JOB_KEYS)[number];

export async function runPlatformJobByKey(jobKey: PlatformJobKey, triggeredBy: string) {
  switch (jobKey) {
    case "platform_billing":
      return runPlatformBillingJob(new Date(), triggeredBy);
    case "tenant_lifecycle":
      return runTenantLifecycleJob(new Date(), triggeredBy);
    case "tenant_usage_rollup":
      return runTenantUsageRollupJob(new Date(), triggeredBy);
    case "platform_dunning":
      return runPlatformDunningJob(new Date(), undefined, triggeredBy);
    default:
      throw Object.assign(new Error("Unknown job."), { status: 400 });
  }
}
