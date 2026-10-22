/**
 * Logical export of one tenant (JSON to stdout or TENANT_EXPORT_FILE).
 *   TENANT_ID=<uuid> npm run tenant:export
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { basePrisma } from "../src/lib/prisma-base";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const restaurantId = (process.env.TENANT_ID || process.env.RESTAURANT_ID || "").trim();
  if (!restaurantId) {
    console.error("Set TENANT_ID to the restaurant uuid.");
    process.exit(1);
  }
  const restaurant = await basePrisma.restaurant.findUnique({ where: { id: restaurantId } });
  if (!restaurant) {
    console.error("Tenant not found.");
    process.exit(1);
  }

  const [settings, branches, categories, menuItems, orders, users, subscription] = await Promise.all([
    basePrisma.storeSettings.findUnique({ where: { id: restaurantId } }),
    basePrisma.branch.findMany({ where: { restaurantId } }),
    basePrisma.category.findMany({ where: { restaurantId }, take: 500 }),
    basePrisma.menuItem.findMany({ where: { restaurantId }, take: 2000 }),
    basePrisma.order.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        total: true,
        createdAt: true,
        customerName: true,
      },
    }),
    basePrisma.user.findMany({
      where: { restaurantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        isOwner: true,
        lastLoginAt: true,
      },
    }),
    basePrisma.subscription.findUnique({ where: { restaurantId }, include: { plan: true } }),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    restaurant,
    settings,
    branches,
    categories,
    menuItems,
    orders,
    users,
    subscription,
  };

  const out = process.env.TENANT_EXPORT_FILE;
  const json = JSON.stringify(payload, null, 2);
  if (out) {
    fs.writeFileSync(path.resolve(out), json, "utf8");
    console.log(`Wrote ${out}`);
  } else {
    process.stdout.write(json);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
