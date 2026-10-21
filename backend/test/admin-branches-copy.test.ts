import { describe, expect, it, afterAll } from "vitest";
import { Role } from "@prisma/client";
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
import { runCopyBranchSetup } from "../src/lib/branches/copy-from";
import { appRequest } from "./helpers/app-request";
import { authHeader, createTestUser } from "./helpers/auth";

const hasDb = Boolean(process.env.DATABASE_URL);
const app = createApp();

describe.skipIf(!hasDb)("branch copy-from", () => {
  let sourceId = "";
  let targetId = "";
  let adminToken = "";

  afterAll(async () => {
    if (sourceId && targetId) {
      await prisma.diningTable.deleteMany({ where: { branchId: { in: [sourceId, targetId] } } });
      await prisma.diningFloor.deleteMany({ where: { branchId: { in: [sourceId, targetId] } } });
      await prisma.printStation.deleteMany({ where: { branchId: { in: [sourceId, targetId] } } });
      await prisma.branch.deleteMany({ where: { id: { in: [sourceId, targetId] } } });
    }
  });

  it("copies tables and stations only for selected parts", async () => {
    const ts = Date.now();
    const admin = await createTestUser({ email: `cpy-adm-${ts}@test.local`, role: Role.ADMIN });
    adminToken = admin.token;
    const restaurant = await prisma.restaurant.findFirst();
    expect(restaurant).toBeTruthy();

    const source = await prisma.branch.create({
      data: {
        restaurantId: restaurant!.id,
        name: "Copy Source",
        code: `CS${String(ts).slice(-3)}`,
        isActive: true,
      },
    });
    const target = await prisma.branch.create({
      data: {
        restaurantId: restaurant!.id,
        name: "Copy Target",
        code: `CT${String(ts).slice(-3)}`,
        isActive: true,
      },
    });
    sourceId = source.id;
    targetId = target.id;

    const floor = await prisma.diningFloor.create({
      data: { branchId: sourceId, name: "Main", sortOrder: 0 },
    });
    await prisma.diningTable.create({
      data: { branchId: sourceId, floorId: floor.id, label: "T99", capacity: 4, zone: "Main" },
    });
    await prisma.printStation.create({
      data: { branchId: sourceId, name: "Kitchen", code: "KOT1", sortOrder: 0 },
    });

    const summary = await runCopyBranchSetup(sourceId, targetId, { tables: true, printStations: true });
    expect(summary.tables).toBe(1);
    expect(summary.printStations).toBe(1);

    const targetTables = await prisma.diningTable.count({ where: { branchId: targetId } });
    expect(targetTables).toBe(1);

    const res = await appRequest(app, "POST", `/admin/branches/${targetId}/copy-from`, {
      headers: authHeader(adminToken),
      body: {
        sourceBranchId: sourceId,
        options: { tables: true },
      },
    });
    expect(res.status).toBe(200);
  });
});
