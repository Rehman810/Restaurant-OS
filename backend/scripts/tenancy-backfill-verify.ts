/**
 * Verify every tenant-owned column is populated (post-migration sanity check).
 */
import path from "path";
import dotenv from "dotenv";
import { Prisma } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";
import fs from "fs";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const allowlistPath = path.join(__dirname, "tenancy-allowlist.json");
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as {
  modelsWithoutRestaurantId: Record<string, string>;
};

async function main() {
  const failures: string[] = [];
  for (const model of Prisma.dmmf.datamodel.models) {
    if (allowlist.modelsWithoutRestaurantId[model.name]) continue;
    const hasRestaurantId = model.fields.some((f) => f.name === "restaurantId");
    if (!hasRestaurantId) {
      failures.push(`${model.name} has no restaurantId and is not allowlisted.`);
      continue;
    }
    const rows = await basePrisma.$queryRawUnsafe<Array<{ c: number }>>(
      `SELECT COUNT(*)::int AS c FROM "${model.name}" WHERE "restaurantId" IS NULL`
    );
    const nulls = Number(rows[0]?.c ?? 0);
    if (nulls > 0) failures.push(`${model.name}: ${nulls} rows with null restaurantId.`);
  }

  if (failures.length) {
    console.error("tenancy:backfill-verify failed");
    for (const f of failures) console.error(`- ${f}`);
    process.exit(1);
  }
  console.log("tenancy:backfill-verify ok");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
