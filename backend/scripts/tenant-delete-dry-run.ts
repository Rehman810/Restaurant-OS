/**
 * Count rows per tenant-owned table for a restaurant (no deletes).
 *   TENANT_ID=<uuid> npm run tenant:delete-dry-run
 */
import path from "path";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const restaurantId = (process.env.TENANT_ID || "").trim();
  if (!restaurantId) {
    console.error("Set TENANT_ID.");
    process.exit(1);
  }
  const restaurant = await basePrisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, slug: true, displayName: true, status: true },
  });
  if (!restaurant) {
    console.error("Tenant not found.");
    process.exit(1);
  }

  const counts: Array<{ model: string; count: number }> = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    const field = model.fields.find((f) => f.name === "restaurantId");
    if (!field) continue;
    const delegate = (basePrisma as Record<string, { count: (args: unknown) => Promise<number> }>)[
      model.name.charAt(0).toLowerCase() + model.name.slice(1)
    ];
    if (!delegate?.count) continue;
    try {
      const count = await delegate.count({ where: { restaurantId } });
      if (count > 0) counts.push({ model: model.name, count });
    } catch {
      /* skip models without standard delegate name */
    }
  }

  counts.sort((a, b) => b.count - a.count);
  console.log(JSON.stringify({ restaurant, tableCounts: counts, totalTables: counts.length }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
