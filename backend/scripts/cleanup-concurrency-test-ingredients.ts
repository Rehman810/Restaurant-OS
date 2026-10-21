/**
 * One-off: list then delete inventory items named "Concurrency test <timestamp>" and their movements.
 * Usage: npx tsx scripts/cleanup-concurrency-test-ingredients.ts
 *        npx tsx scripts/cleanup-concurrency-test-ingredients.ts --confirm
 */
import { prisma } from "../src/lib/prisma";

const PATTERN = /^Concurrency test \d+$/;

async function main() {
  const confirm = process.argv.includes("--confirm");
  const matches = await prisma.inventoryItem.findMany({
    where: { name: { startsWith: "Concurrency test " } },
    select: { id: true, name: true },
  });
  const toDelete = matches.filter((m) => PATTERN.test(m.name));

  console.log(`Found ${toDelete.length} ingredient(s) matching "Concurrency test <timestamp>":`);
  for (const row of toDelete) {
    console.log(`  - ${row.name} (${row.id})`);
  }

  if (!confirm) {
    console.log("\nDry run only. Re-run with --confirm to delete these items (cascades movements).");
    return;
  }

  if (!toDelete.length) {
    console.log("Nothing to delete.");
    return;
  }

  const ids = toDelete.map((r) => r.id);
  const deleted = await prisma.inventoryItem.deleteMany({ where: { id: { in: ids } } });
  console.log(`Deleted ${deleted.count} ingredient(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
