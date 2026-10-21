#!/usr/bin/env npx tsx
/**
 * Read-only report of test / fixture staff accounts.
 * Usage (repo root): npx tsx scripts/report-test-staff.ts
 */
import path from "path";
import dotenv from "dotenv";

const repoRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(repoRoot, "backend", ".env") });

async function main() {
  const { prisma } = await import("../backend/src/lib/prisma");
  const { buildTestStaffReport, formatSummaryTable, writeTestStaffReportFiles } = await import(
    "../backend/src/lib/test-staff/report"
  );

  const { summary, rows } = await buildTestStaffReport();
  console.log(formatSummaryTable(summary));
  console.log(`\nDetail rows: ${rows.length} (see CSV in docs/reports/)`);

  const { summaryPath, csvPath } = await writeTestStaffReportFiles(repoRoot);
  console.log(`\nWrote:\n  ${summaryPath}\n  ${csvPath}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
