import type { Prisma } from "@prisma/client";
import { slugifyAreaName } from "../delivery/validate";
import { legacySchedule } from "../hours";
import { deliveryAreaRowsForCity } from "./delivery-area-templates";

const STARTER_CATEGORIES = [
  { name: "Burgers", tagline: "Stacked and loaded" },
  { name: "Sides", tagline: "Perfect add-ons" },
  { name: "Beverages", tagline: "Ice-cold sips" },
] as const;

const STARTER_ITEMS = [
  {
    name: "Zinger Burger",
    description: "Crunchy spicy fillet, cheese, lettuce and secret sauce.",
    price: 790,
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&h=800&q=85",
  },
  {
    name: "Beef Smash Burger",
    description: "Double smash patties, cheese, pickles and caramelized onions.",
    price: 950,
    category: "Burgers",
    imageUrl:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&h=800&q=85",
  },
  {
    name: "French Fries",
    description: "Crispy golden fries with house seasoning.",
    price: 290,
    category: "Sides",
    imageUrl:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=1200&h=800&q=85",
  },
  {
    name: "Soft Drink",
    description: "Chilled 345ml can.",
    price: 150,
    category: "Beverages",
    imageUrl:
      "https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=1200&h=800&q=85",
  },
] as const;

export function defaultWeeklyScheduleJson() {
  return legacySchedule(12, 0, 1, 30) as object;
}

export async function seedDeliveryAreasForTenant(
  tx: Prisma.TransactionClient,
  input: { restaurantId: string; branchId: string; city: string }
) {
  const rows = deliveryAreaRowsForCity(input.city);
  if (!rows.length) return 0;

  let sortOrder = 0;
  for (const row of rows) {
    sortOrder += 1;
    const area = await tx.deliveryArea.create({
      data: {
        restaurantId: input.restaurantId,
        name: row.name,
        slug: slugifyAreaName(row.name),
        deliveryCharge: row.deliveryCharge,
        isDelivering: row.isDelivering,
        sortOrder,
      },
    });
    await tx.deliveryAreaBranch.create({
      data: {
        restaurantId: input.restaurantId,
        areaId: area.id,
        branchId: input.branchId,
      },
    });
  }
  return rows.length;
}

export async function seedStarterMenuForTenant(tx: Prisma.TransactionClient, restaurantId: string) {
  for (let i = 0; i < STARTER_CATEGORIES.length; i++) {
    const cat = STARTER_CATEGORIES[i];
    await tx.category.create({
      data: {
        restaurantId,
        name: cat.name,
        tagline: cat.tagline,
        sortOrder: i + 1,
      },
    });
  }

  for (let i = 0; i < STARTER_ITEMS.length; i++) {
    const item = STARTER_ITEMS[i];
    await tx.menuItem.create({
      data: {
        restaurantId,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        imageUrl: item.imageUrl,
        sortOrder: i + 1,
      },
    });
  }
  return { categories: STARTER_CATEGORIES.length, items: STARTER_ITEMS.length };
}
