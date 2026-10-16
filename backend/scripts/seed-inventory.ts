import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { seedInventoryDemo } from "../src/lib/inventory/seed-demo";

async function main() {
  const branch = await prisma.branch.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
  });
  if (!branch) {
    console.error("No active branch found. Run full seed first.");
    process.exit(1);
  }
  const result = await seedInventoryDemo(branch.id, { refreshStock: true });
  console.log(`Seeded inventory on branch "${branch.name}":`, result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
