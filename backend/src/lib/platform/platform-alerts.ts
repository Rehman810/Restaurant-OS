import { PlatformAlertChannel } from "@prisma/client";
import { basePrisma } from "../prisma-base";
import { withoutTenant } from "../restaurant-context";
import { sendPlatformBroadcastEmail } from "../email";

export async function dispatchPlatformAlerts(input: {
  action: string;
  actorEmail?: string;
  subjectTenantId?: string | null;
}) {
  let rules: Awaited<ReturnType<typeof basePrisma.platformAlertRule.findMany>>;
  try {
    rules = await withoutTenant("alert rules", () =>
      basePrisma.platformAlertRule.findMany({ where: { enabled: true } })
    );
  } catch (err) {
    const code = typeof err === "object" && err && "code" in err ? String((err as { code: string }).code) : "";
    if (code === "P2021" || code === "P2010") return;
    throw err;
  }
  for (const rule of rules) {
    if (rule.actionPattern && !input.action.includes(rule.actionPattern)) continue;
    const body = `Platform audit: ${input.action}\nActor: ${input.actorEmail || "—"}\nTenant: ${input.subjectTenantId || "—"}`;
    try {
      if (rule.channel === PlatformAlertChannel.EMAIL && rule.target.includes("@")) {
        await sendPlatformBroadcastEmail({
          to: rule.target,
          tenantName: "Platform",
          title: `Alert: ${input.action}`,
          body,
          severity: "WARNING",
        });
      } else if (rule.channel === PlatformAlertChannel.SLACK && rule.target.startsWith("http")) {
        await fetch(rule.target, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: body }),
        });
      }
    } catch {
      /* best-effort */
    }
  }
}
