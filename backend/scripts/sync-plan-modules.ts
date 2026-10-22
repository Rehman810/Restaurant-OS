/**
 * Align built-in plan module flags (Starter vs Growth). Safe to re-run.
 * npm run plans:sync-modules
 */
import "dotenv/config";
import { basePrisma } from "../src/lib/prisma-base";

const STARTER = {
  maxBranches: 1,
  maxStaff: 10,
  pos: true,
  kitchen: true,
  catalog: true,
  inventory: false,
  dineIn: false,
  analytics: false,
  delivery: false,
  shifts: false,
  staff: true,
  dashboard: true,
  auditLog: true,
  branches: false,
};

const GROWTH = {
  maxBranches: 10,
  maxStaff: 100,
  pos: true,
  kitchen: true,
  catalog: true,
  inventory: true,
  dineIn: true,
  analytics: true,
  delivery: true,
  shifts: true,
  staff: true,
  dashboard: true,
  auditLog: true,
  branches: true,
};

async function main() {
  for (const [slug, entitlements] of Object.entries({ starter: STARTER, growth: GROWTH })) {
    const plan = await basePrisma.plan.findUnique({ where: { slug } });
    if (!plan) {
      console.log(`skip ${slug}: plan not found`);
      continue;
    }
    await basePrisma.plan.update({ where: { id: plan.id }, data: { entitlements } });
    console.log(`updated ${slug} entitlements`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
