import fs from "fs";
import path from "path";
import { Prisma } from "@prisma/client";

const backendRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(backendRoot, "..");
const allowlistPath = path.join(backendRoot, "scripts/tenancy-allowlist.json");
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as {
  modelsWithoutRestaurantId: Record<string, string>;
  withoutTenantFiles: string[];
};

const failures: string[] = [];

for (const model of Prisma.dmmf.datamodel.models) {
  const hasRestaurantId = model.fields.some((field) => field.name === "restaurantId");
  const reason = allowlist.modelsWithoutRestaurantId[model.name];
  if (!hasRestaurantId && !reason) {
    failures.push(`${model.name} has no restaurantId and is not allowlisted.`);
  }
  if (!hasRestaurantId && reason && !reason.trim()) {
    failures.push(`${model.name} allowlist reason is empty.`);
  }
  if (hasRestaurantId && reason) {
    failures.push(`${model.name} has restaurantId and is also allowlisted. Pick one.`);
  }
}

for (const [name, reason] of Object.entries(allowlist.modelsWithoutRestaurantId)) {
  if (!Prisma.dmmf.datamodel.models.some((model) => model.name === name)) {
    failures.push(`Allowlist names missing model ${name}.`);
  }
  if (!reason.trim()) failures.push(`Allowlist reason for ${name} is empty.`);
}

function walk(dir: string, out: string[]) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
}

const files: string[] = [];
walk(path.join(backendRoot, "src"), files);
const allowed = new Set(allowlist.withoutTenantFiles.map((file) => path.normalize(file)));
const definition = path.normalize("backend/src/lib/restaurant-context.ts");

for (const file of files) {
  const rel = path.normalize(path.relative(repoRoot, file));
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("withoutTenant(")) continue;
  if (rel === definition) continue;
  if (!allowed.has(rel)) {
    failures.push(`withoutTenant() in ${rel} is not allowlisted.`);
  }
}

const rawPattern = /\$queryRaw(?:Unsafe)?\(|\$executeRaw(?:Unsafe)?\(/;
const basePrismaAllowed = new Set([
  path.normalize("backend/src/lib/prisma.ts"),
  path.normalize("backend/src/lib/prisma-base.ts"),
  path.normalize("backend/src/lib/tenant-resolve.ts"),
  path.normalize("backend/src/lib/tenant-sql.ts"),
  path.normalize("backend/src/lib/tenant-jobs.ts"),
  path.normalize("backend/src/lib/platform/billing-job.ts"),
  path.normalize("backend/src/lib/platform/payments.ts"),
  path.normalize("backend/src/lib/platform/platform-audit.ts"),
  path.normalize("backend/src/middleware/platform-auth.ts"),
  path.normalize("backend/src/routes/platform/auth.ts"),
  path.normalize("backend/src/routes/platform/tenants.ts"),
  path.normalize("backend/src/routes/platform/plans.ts"),
  path.normalize("backend/src/routes/platform/invoices.ts"),
  path.normalize("backend/src/routes/platform/audit-logs.ts"),
  path.normalize("backend/src/lib/platform/lifecycle-job.ts"),
  path.normalize("backend/src/lib/platform/provision.ts"),
  path.normalize("backend/src/lib/platform/support-access.ts"),
  path.normalize("backend/src/lib/platform/job-runs.ts"),
  path.normalize("backend/src/lib/platform/platform-settings.ts"),
  path.normalize("backend/src/lib/platform/overview.ts"),
  path.normalize("backend/src/lib/platform/announcements.ts"),
  path.normalize("backend/src/lib/platform/tenant-health.ts"),
  path.normalize("backend/src/lib/platform/usage-rollup-job.ts"),
  path.normalize("backend/src/routes/platform/overview.ts"),
  path.normalize("backend/src/routes/platform/announcements.ts"),
  path.normalize("backend/src/routes/platform/settings.ts"),
  path.normalize("backend/src/routes/platform/health.ts"),
  path.normalize("backend/src/routes/admin-support-access.ts"),
  path.normalize("backend/src/middleware/tenant-lifecycle.ts"),
]);
for (const file of files) {
  const rel = path.normalize(path.relative(repoRoot, file));
  if (rel === path.normalize("backend/src/lib/tenant-sql.ts")) continue;
  const text = fs.readFileSync(file, "utf8");
  if (rawPattern.test(text)) {
    failures.push(`${rel} uses raw SQL outside tenant-sql.ts.`);
  }
  if (text.includes("basePrisma") && !basePrismaAllowed.has(rel)) {
    failures.push(`${rel} uses basePrisma without an allowlist entry.`);
  }
}

if (failures.length) {
  console.error("tenancy:check failed");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `tenancy:check ok (${Prisma.dmmf.datamodel.models.length} models, ${Object.keys(allowlist.modelsWithoutRestaurantId).length} allowlisted)`
);
