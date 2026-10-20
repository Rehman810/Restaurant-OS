import { Role } from "@prisma/client";
import { buildTrackingBoard } from "../src/lib/admin-orders/board";
import { prisma } from "../src/lib/prisma";
import { getStoreSettings } from "../src/lib/settings-data";

async function main() {
  const settings = await getStoreSettings();
  const branch = await prisma.branch.findFirst({ where: { isActive: true } });
  if (!branch) {
    console.error("No active branch");
    process.exit(1);
  }
  const req = {
    query: {},
    user: { id: "bench", role: Role.ADMIN, email: "a@a.com", name: "Bench" },
  };
  const scope = { allBranches: false, branchId: branch.id, where: { branchId: branch.id } };
  const tz = settings.timezone || "Asia/Karachi";
  const payload = await buildTrackingBoard(req as never, scope as never, req.user as never, tz, {
    lateConfirmMinutes: settings.lateConfirmMinutes ?? 15,
    latePrepMinutes: settings.latePrepMinutes ?? 30,
    lateDeliveryMinutes: settings.lateDeliveryMinutes ?? 45,
    ordersStaleHours: settings.ordersStaleHours ?? 2,
    trackingCompletedWindowHours: settings.trackingCompletedWindowHours ?? 0,
    duplicateOrderWindowMinutes: settings.duplicateOrderWindowMinutes ?? 10,
  });
  console.log(`tracking board timingMs=${payload.timingMs} active=${payload.summary.active}`);
  if (payload.timingMs > 300) {
    console.warn("WARN: exceeds 300ms target on this machine");
    process.exit(2);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
