import { Prisma } from "@prisma/client";
import { getRestaurantId } from "./restaurant-context";
import { prisma } from "./prisma";
import { tenantExecuteRaw, tenantQueryRaw } from "./tenant-sql";

export type CounterTx = {
  $executeRaw: Function;
  $queryRaw: Function;
};

export type CounterName = "order" | "pos_order" | "invoice" | "kot" | "shift" | "platform_invoice";

/**
 * Increments a counter row under a row lock (UPDATE … RETURNING).
 * The first insert uses `floor` as the value before the increment, so the first
 * allocated number is floor + 1 when the row is new.
 */
export async function allocateCounter(
  tx: CounterTx,
  input: { name: CounterName; branchId?: string; periodKey?: string; floor?: number }
): Promise<number> {
  const restaurantId = getRestaurantId();
  const branchId = input.branchId ?? "";
  const periodKey = input.periodKey ?? "";
  const floor = input.floor ?? 0;
  await tenantExecuteRaw(
    tx,
    Prisma.sql`
      INSERT INTO "TenantCounter" ("id", "restaurantId", "branchId", "name", "periodKey", "lastValue")
      VALUES (${crypto.randomUUID()}, ${restaurantId}, ${branchId}, ${input.name}, ${periodKey}, ${floor})
      ON CONFLICT ("restaurantId", "branchId", "name", "periodKey") DO NOTHING
    `
  );
  const rows = await tenantQueryRaw<Array<{ lastValue: number }>>(
    tx,
    Prisma.sql`
      UPDATE "TenantCounter"
      SET "lastValue" = "lastValue" + 1
      WHERE "restaurantId" = ${restaurantId}
        AND "branchId" = ${branchId}
        AND "name" = ${input.name}
        AND "periodKey" = ${periodKey}
      RETURNING "lastValue"
    `
  );
  const next = rows[0]?.lastValue;
  if (!next) throw new Error("Counter update did not return a value.");
  return next;
}

export async function nextCounter(input: {
  name: CounterName;
  branchId?: string;
  periodKey?: string;
  floor?: number;
}): Promise<number> {
  return prisma.$transaction((tx) => allocateCounter(tx, input));
}
