/**
 * Local multi-tenant URLs: {slug}.localhost → each Restaurant row.
 * Run: npm run tenancy:local-dev
 */
import "dotenv/config";
import { TenantStatus } from "@prisma/client";
import { basePrisma } from "../src/lib/prisma-base";
import { invalidateTenantHostCache } from "../src/lib/tenant-resolve";

const DEV_PROXY_SECRET = "local-dev-tenant-proxy";

async function main() {
  const rows = await basePrisma.restaurant.findMany({
    where: { status: { not: TenantStatus.ARCHIVED } },
    select: { id: true, slug: true, displayName: true, hostname: true },
    orderBy: { createdAt: "asc" },
  });
  if (rows.length === 0) {
    console.log("No tenants found. Run seed or create tenants in the platform panel first.");
    return;
  }

  console.log("Setting local hostnames (slug.localhost):\n");
  for (const row of rows) {
    const hostname = `${row.slug}.localhost`;
    if (row.hostname === hostname) {
      console.log(`  · ${row.displayName} (${row.slug}) — already ${hostname}`);
      continue;
    }
    const taken = await basePrisma.restaurant.findFirst({
      where: { hostname, id: { not: row.id } },
      select: { slug: true },
    });
    if (taken) {
      console.warn(`  ! skip ${row.slug}: ${hostname} used by ${taken.slug}`);
      continue;
    }
    await basePrisma.restaurant.update({
      where: { id: row.id },
      data: { hostname },
    });
    invalidateTenantHostCache(hostname);
    if (row.hostname) invalidateTenantHostCache(row.hostname);
    console.log(`  ✓ ${row.displayName} (${row.slug}) → http://${hostname}:3000`);
  }

  invalidateTenantHostCache();

  console.log(`
Add to backend/.env:
  SINGLE_TENANT_MODE=false
  TENANT_PROXY_SECRET=${DEV_PROXY_SECRET}
  CLIENT_URL=http://localhost:3000,http://main.localhost:3000,http://localhost:3100

Add to frontend/.env.local (create if missing):
  TENANT_PROXY_SECRET=${DEV_PROXY_SECRET}
  API_PROXY_TARGET=http://127.0.0.1:4000

Restart API + frontend, then open:
  http://main.localhost:3000
  http://<other-slug>.localhost:3000

Platform panel stays http://localhost:3100
`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
