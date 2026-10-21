#!/usr/bin/env npx tsx
/**
 * Dry-run cleanup of test staff accounts. Pass --apply to execute (after backup).
 * Usage (repo root): npx tsx scripts/cleanup-test-staff.ts
 *                    npx tsx scripts/cleanup-test-staff.ts --apply
 */
import path from "path";
import dotenv from "dotenv";

const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, "backend", ".env") });

async function main() {
  const apply = process.argv.includes("--apply");
  const { prisma } = await import("../backend/src/lib/prisma");
  const { planTestStaffCleanup, formatCleanupPlan, applyTestStaffCleanup } = await import(
    "../backend/src/lib/test-staff/cleanup"
  );

  const plan = await planTestStaffCleanup();
  console.log(formatCleanupPlan(plan));

  if (!apply) {
    console.log(
      "\nDry run only — no database changes.\n" +
        "Back up or export the database before applying.\n" +
        "Re-run with --apply to execute the plan above."
    );
    await prisma.$disconnect();
    return;
  }

  console.log(
    "\n*** APPLY MODE ***\n" +
      "Ensure you have a database backup or export before continuing.\n"
  );
  await applyTestStaffCleanup(plan);
  console.log("\nCleanup applied.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
