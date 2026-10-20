import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedAnalyticsDemo } from "../src/lib/analytics/seed-demo";

const prisma = new PrismaClient();

async function main() {
  const branch = await prisma.branch.findFirst({
    where: { restaurantId: "11111111-1111-4111-8111-111111111111", isActive: true },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }],
  });
  if (!branch) {
    console.error("No active branch. Run npm run prisma:seed first.");
    process.exit(1);
  }
  const rider = await prisma.user.findFirst({ where: { email: "rider@demo.restaurant" }, select: { id: true } });
  const result = await seedAnalyticsDemo(prisma, branch.id, rider?.id);
  console.log(
    `Analytics demo orders: ${result.created} created (${result.deleted} previous ANL-* orders replaced).`
  );
  console.log("Open /admin/analytics with preset “This month” or “Last 30 days” to view charts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
