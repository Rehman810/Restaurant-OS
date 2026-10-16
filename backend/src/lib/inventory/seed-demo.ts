import { InventoryUnit, StockMovementType } from "@prisma/client";
import { prisma } from "../prisma";
import { applyStockChange } from "./ledger";

const RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

const CATEGORIES = [
  "Meat",
  "Seafood",
  "Dairy",
  "Vegetables",
  "Spices",
  "Oil & Fats",
  "Dry Goods",
  "Bakery",
  "Beverages",
  "Packaging",
  "Other",
];

type IngredientSeed = {
  name: string;
  category: string;
  unit: InventoryUnit;
  cost: number;
  reorder: number;
  par?: number;
  trackExpiry?: boolean;
  /** Opening stock multiplier on reorder (default 4) */
  stockMul?: number;
};

const INGREDIENTS: IngredientSeed[] = [
  { name: "Chicken breast", category: "Meat", unit: InventoryUnit.KG, cost: 650, reorder: 8 },
  { name: "Chicken wings", category: "Meat", unit: InventoryUnit.KG, cost: 520, reorder: 5 },
  { name: "Beef mince", category: "Meat", unit: InventoryUnit.KG, cost: 1100, reorder: 4 },
  { name: "Mutton cubes", category: "Meat", unit: InventoryUnit.KG, cost: 1450, reorder: 3 },
  { name: "Fish fillet", category: "Seafood", unit: InventoryUnit.PIECE, cost: 180, reorder: 20 },
  { name: "Prawns peeled", category: "Seafood", unit: InventoryUnit.KG, cost: 2200, reorder: 2, trackExpiry: true },
  { name: "Mozzarella cheese", category: "Dairy", unit: InventoryUnit.KG, cost: 1800, reorder: 3, trackExpiry: true },
  { name: "Cheddar cheese", category: "Dairy", unit: InventoryUnit.KG, cost: 1600, reorder: 2, trackExpiry: true },
  { name: "Butter", category: "Dairy", unit: InventoryUnit.KG, cost: 1200, reorder: 2 },
  { name: "Cream", category: "Dairy", unit: InventoryUnit.L, cost: 900, reorder: 2, trackExpiry: true },
  { name: "Yogurt", category: "Dairy", unit: InventoryUnit.KG, cost: 280, reorder: 5, trackExpiry: true },
  { name: "Eggs", category: "Dairy", unit: InventoryUnit.DOZEN, cost: 320, reorder: 3, trackExpiry: true },
  { name: "Potatoes", category: "Vegetables", unit: InventoryUnit.KG, cost: 120, reorder: 15 },
  { name: "Onions", category: "Vegetables", unit: InventoryUnit.KG, cost: 90, reorder: 10 },
  { name: "Tomatoes", category: "Vegetables", unit: InventoryUnit.KG, cost: 110, reorder: 8 },
  { name: "Lettuce", category: "Vegetables", unit: InventoryUnit.KG, cost: 200, reorder: 4, trackExpiry: true },
  { name: "Garlic", category: "Vegetables", unit: InventoryUnit.KG, cost: 350, reorder: 2 },
  { name: "Lemons", category: "Vegetables", unit: InventoryUnit.KG, cost: 180, reorder: 3 },
  { name: "Mint leaves", category: "Vegetables", unit: InventoryUnit.KG, cost: 400, reorder: 1, trackExpiry: true },
  { name: "Biryani spice mix", category: "Spices", unit: InventoryUnit.KG, cost: 800, reorder: 2 },
  { name: "Karahi masala", category: "Spices", unit: InventoryUnit.KG, cost: 750, reorder: 2 },
  { name: "BBQ marinade", category: "Spices", unit: InventoryUnit.L, cost: 650, reorder: 2 },
  { name: "Cooking oil", category: "Oil & Fats", unit: InventoryUnit.L, cost: 420, reorder: 10 },
  { name: "Basmati rice", category: "Dry Goods", unit: InventoryUnit.KG, cost: 280, reorder: 20 },
  { name: "Penne pasta dry", category: "Dry Goods", unit: InventoryUnit.KG, cost: 320, reorder: 5 },
  { name: "Breading flour", category: "Dry Goods", unit: InventoryUnit.KG, cost: 150, reorder: 8 },
  { name: "Sweet corn", category: "Dry Goods", unit: InventoryUnit.KG, cost: 220, reorder: 3 },
  { name: "Burger buns", category: "Bakery", unit: InventoryUnit.PIECE, cost: 35, reorder: 40 },
  { name: "Pizza dough ball 12in", category: "Bakery", unit: InventoryUnit.PIECE, cost: 95, reorder: 25, trackExpiry: true },
  { name: "Garlic bread loaf", category: "Bakery", unit: InventoryUnit.PIECE, cost: 120, reorder: 10, trackExpiry: true },
  { name: "Naan bread", category: "Bakery", unit: InventoryUnit.PIECE, cost: 25, reorder: 30 },
  { name: "Soft drink can", category: "Beverages", unit: InventoryUnit.PIECE, cost: 85, reorder: 48 },
  { name: "Mango pulp", category: "Beverages", unit: InventoryUnit.L, cost: 450, reorder: 3, trackExpiry: true },
  { name: "Tea leaves", category: "Beverages", unit: InventoryUnit.KG, cost: 1200, reorder: 1 },
  { name: "Coffee powder", category: "Beverages", unit: InventoryUnit.KG, cost: 2800, reorder: 1 },
  { name: "Ice cream base", category: "Dairy", unit: InventoryUnit.L, cost: 550, reorder: 2, trackExpiry: true },
  { name: "Chocolate couverture", category: "Dry Goods", unit: InventoryUnit.KG, cost: 1900, reorder: 2 },
  { name: "Gulab jamun mix", category: "Dry Goods", unit: InventoryUnit.KG, cost: 600, reorder: 2 },
  { name: "Takeaway box", category: "Packaging", unit: InventoryUnit.PACK, cost: 12, reorder: 100, stockMul: 8 },
  { name: "Napkins pack", category: "Packaging", unit: InventoryUnit.PACK, cost: 180, reorder: 5 },
];

/** Menu item name (substring match, case-insensitive) → recipe lines per portion */
const RECIPES: { match: string; yieldPortions?: number; lines: { ingredient: string; qty: number }[] }[] = [
  {
    match: "Zinger Burger",
    lines: [
      { ingredient: "Chicken breast", qty: 0.16 },
      { ingredient: "Burger buns", qty: 1 },
      { ingredient: "Lettuce", qty: 0.02 },
      { ingredient: "Cooking oil", qty: 0.04 },
      { ingredient: "Breading flour", qty: 0.03 },
    ],
  },
  {
    match: "Beef Smash Burger",
    lines: [
      { ingredient: "Beef mince", qty: 0.18 },
      { ingredient: "Burger buns", qty: 1 },
      { ingredient: "Cheddar cheese", qty: 0.04 },
      { ingredient: "Cooking oil", qty: 0.02 },
    ],
  },
  {
    match: "Grilled Chicken Burger",
    lines: [
      { ingredient: "Chicken breast", qty: 0.14 },
      { ingredient: "Burger buns", qty: 1 },
      { ingredient: "Lettuce", qty: 0.02 },
    ],
  },
  {
    match: "Fish Fillet Burger",
    lines: [
      { ingredient: "Fish fillet", qty: 1 },
      { ingredient: "Burger buns", qty: 1 },
      { ingredient: "Breading flour", qty: 0.02 },
      { ingredient: "Cooking oil", qty: 0.03 },
    ],
  },
  {
    match: "Club Sandwich",
    lines: [
      { ingredient: "Chicken breast", qty: 0.1 },
      { ingredient: "Eggs", qty: 0.25 },
      { ingredient: "Burger buns", qty: 2 },
      { ingredient: "Lettuce", qty: 0.03 },
    ],
  },
  {
    match: "Chicken Pakora",
    lines: [
      { ingredient: "Chicken breast", qty: 0.12 },
      { ingredient: "Breading flour", qty: 0.05 },
      { ingredient: "Cooking oil", qty: 0.08 },
      { ingredient: "Yogurt", qty: 0.05 },
    ],
  },
  {
    match: "Dynamite Prawns",
    lines: [
      { ingredient: "Prawns peeled", qty: 0.15 },
      { ingredient: "Cooking oil", qty: 0.06 },
      { ingredient: "Cream", qty: 0.05 },
    ],
  },
  {
    match: "Chicken Wings",
    lines: [
      { ingredient: "Chicken wings", qty: 0.35 },
      { ingredient: "Cooking oil", qty: 0.1 },
      { ingredient: "BBQ marinade", qty: 0.05 },
    ],
  },
  {
    match: "Mozzarella Sticks",
    lines: [
      { ingredient: "Mozzarella cheese", qty: 0.12 },
      { ingredient: "Breading flour", qty: 0.04 },
      { ingredient: "Cooking oil", qty: 0.06 },
    ],
  },
  {
    match: "Chicken Corn Soup",
    lines: [
      { ingredient: "Chicken breast", qty: 0.08 },
      { ingredient: "Sweet corn", qty: 0.1 },
      { ingredient: "Cream", qty: 0.08 },
    ],
  },
  {
    match: "Chicken Tikka Pizza",
    lines: [
      { ingredient: "Pizza dough ball 12in", qty: 1 },
      { ingredient: "Mozzarella cheese", qty: 0.15 },
      { ingredient: "Chicken breast", qty: 0.12 },
      { ingredient: "Tomatoes", qty: 0.08 },
    ],
  },
  {
    match: "Pepperoni Pizza",
    lines: [
      { ingredient: "Pizza dough ball 12in", qty: 1 },
      { ingredient: "Mozzarella cheese", qty: 0.18 },
      { ingredient: "Tomatoes", qty: 0.08 },
    ],
  },
  {
    match: "Margherita Pizza",
    lines: [
      { ingredient: "Pizza dough ball 12in", qty: 1 },
      { ingredient: "Mozzarella cheese", qty: 0.16 },
      { ingredient: "Tomatoes", qty: 0.1 },
    ],
  },
  {
    match: "Pasta Alfredo",
    lines: [
      { ingredient: "Penne pasta dry", qty: 0.12 },
      { ingredient: "Cream", qty: 0.15 },
      { ingredient: "Butter", qty: 0.03 },
      { ingredient: "Chicken breast", qty: 0.1 },
    ],
  },
  {
    match: "Arrabiata Penne",
    lines: [
      { ingredient: "Penne pasta dry", qty: 0.12 },
      { ingredient: "Tomatoes", qty: 0.15 },
      { ingredient: "Garlic", qty: 0.01 },
      { ingredient: "Cooking oil", qty: 0.03 },
    ],
  },
  {
    match: "Chicken Biryani",
    lines: [
      { ingredient: "Basmati rice", qty: 0.22 },
      { ingredient: "Chicken breast", qty: 0.18 },
      { ingredient: "Biryani spice mix", qty: 0.015 },
      { ingredient: "Yogurt", qty: 0.06 },
      { ingredient: "Cooking oil", qty: 0.04 },
    ],
  },
  {
    match: "Beef Biryani",
    lines: [
      { ingredient: "Basmati rice", qty: 0.22 },
      { ingredient: "Beef mince", qty: 0.16 },
      { ingredient: "Biryani spice mix", qty: 0.015 },
      { ingredient: "Yogurt", qty: 0.06 },
    ],
  },
  {
    match: "Mutton Pulao",
    lines: [
      { ingredient: "Basmati rice", qty: 0.24 },
      { ingredient: "Mutton cubes", qty: 0.15 },
      { ingredient: "Onions", qty: 0.08 },
    ],
  },
  {
    match: "Egg Fried Rice",
    lines: [
      { ingredient: "Basmati rice", qty: 0.2 },
      { ingredient: "Eggs", qty: 0.5 },
      { ingredient: "Cooking oil", qty: 0.04 },
    ],
  },
  {
    match: "BBQ Broast Quarter",
    lines: [
      { ingredient: "Chicken breast", qty: 0.35 },
      { ingredient: "Breading flour", qty: 0.08 },
      { ingredient: "Cooking oil", qty: 0.15 },
    ],
  },
  {
    match: "BBQ Broast Half",
    yieldPortions: 1,
    lines: [
      { ingredient: "Chicken breast", qty: 0.7 },
      { ingredient: "Breading flour", qty: 0.15 },
      { ingredient: "Cooking oil", qty: 0.28 },
    ],
  },
  {
    match: "Chicken Tikka Platter",
    lines: [
      { ingredient: "Chicken breast", qty: 0.4 },
      { ingredient: "Yogurt", qty: 0.1 },
      { ingredient: "BBQ marinade", qty: 0.08 },
      { ingredient: "Naan bread", qty: 2 },
    ],
  },
  {
    match: "Seekh Kebab",
    lines: [
      { ingredient: "Beef mince", qty: 0.2 },
      { ingredient: "Onions", qty: 0.05 },
      { ingredient: "Karahi masala", qty: 0.01 },
    ],
  },
  {
    match: "Malai Boti",
    lines: [
      { ingredient: "Chicken breast", qty: 0.22 },
      { ingredient: "Cream", qty: 0.08 },
      { ingredient: "Yogurt", qty: 0.06 },
    ],
  },
  {
    match: "Chicken Karahi",
    lines: [
      { ingredient: "Chicken breast", qty: 0.35 },
      { ingredient: "Tomatoes", qty: 0.2 },
      { ingredient: "Karahi masala", qty: 0.02 },
      { ingredient: "Cooking oil", qty: 0.05 },
    ],
  },
  {
    match: "Mutton Karahi",
    lines: [
      { ingredient: "Mutton cubes", qty: 0.32 },
      { ingredient: "Tomatoes", qty: 0.2 },
      { ingredient: "Karahi masala", qty: 0.02 },
    ],
  },
  {
    match: "Butter Chicken",
    lines: [
      { ingredient: "Chicken breast", qty: 0.28 },
      { ingredient: "Butter", qty: 0.06 },
      { ingredient: "Cream", qty: 0.1 },
      { ingredient: "Tomatoes", qty: 0.12 },
    ],
  },
  {
    match: "Daal Makhni",
    lines: [
      { ingredient: "Butter", qty: 0.04 },
      { ingredient: "Cream", qty: 0.08 },
      { ingredient: "Tomatoes", qty: 0.1 },
    ],
  },
  {
    match: "Masala Fries",
    lines: [
      { ingredient: "Potatoes", qty: 0.2 },
      { ingredient: "Cooking oil", qty: 0.08 },
      { ingredient: "Biryani spice mix", qty: 0.005 },
    ],
  },
  {
    match: "Garlic Bread",
    lines: [
      { ingredient: "Garlic bread loaf", qty: 1 },
      { ingredient: "Butter", qty: 0.02 },
      { ingredient: "Garlic", qty: 0.005 },
    ],
  },
  {
    match: "Coleslaw",
    lines: [
      { ingredient: "Lettuce", qty: 0.05 },
      { ingredient: "Yogurt", qty: 0.08 },
    ],
  },
  {
    match: "Raita",
    lines: [{ ingredient: "Yogurt", qty: 0.15 }],
  },
  {
    match: "Fresh Lime Soda",
    lines: [
      { ingredient: "Lemons", qty: 0.04 },
      { ingredient: "Soft drink can", qty: 0.5 },
    ],
  },
  {
    match: "Mango Lassi",
    lines: [
      { ingredient: "Mango pulp", qty: 0.12 },
      { ingredient: "Yogurt", qty: 0.15 },
    ],
  },
  {
    match: "Kashmiri Chai",
    lines: [
      { ingredient: "Tea leaves", qty: 0.008 },
      { ingredient: "Cream", qty: 0.05 },
    ],
  },
  {
    match: "Cold Coffee",
    lines: [
      { ingredient: "Coffee powder", qty: 0.015 },
      { ingredient: "Cream", qty: 0.08 },
      { ingredient: "Ice cream base", qty: 0.05 },
    ],
  },
  {
    match: "Mint Margarita",
    lines: [
      { ingredient: "Mint leaves", qty: 0.02 },
      { ingredient: "Lemons", qty: 0.03 },
    ],
  },
  {
    match: "Soft Drink",
    lines: [{ ingredient: "Soft drink can", qty: 1 }],
  },
  {
    match: "Gulab Jamun",
    lines: [{ ingredient: "Gulab jamun mix", qty: 0.08 }],
  },
  {
    match: "Molten Lava Cake",
    lines: [
      { ingredient: "Chocolate couverture", qty: 0.06 },
      { ingredient: "Butter", qty: 0.03 },
      { ingredient: "Eggs", qty: 0.2 },
    ],
  },
  {
    match: "Kulfi Falooda",
    lines: [
      { ingredient: "Ice cream base", qty: 0.15 },
      { ingredient: "Mango pulp", qty: 0.05 },
    ],
  },
  {
    match: "Brownie Sundae",
    lines: [
      { ingredient: "Chocolate couverture", qty: 0.08 },
      { ingredient: "Ice cream base", qty: 0.12 },
    ],
  },
  {
    match: "Loaded Nachos",
    lines: [
      { ingredient: "Cheddar cheese", qty: 0.08 },
      { ingredient: "Tomatoes", qty: 0.06 },
      { ingredient: "Takeaway box", qty: 0.1 },
    ],
  },
];

async function upsertIngredient(
  d: IngredientSeed,
  categoryId: string | undefined,
  branchId: string,
  refreshStock: boolean
) {
  const item = await prisma.inventoryItem.upsert({
    where: { restaurantId_name: { restaurantId: RESTAURANT_ID, name: d.name } },
    create: {
      name: d.name,
      category: d.category,
      categoryId: categoryId ?? null,
      unit: d.unit,
      defaultCost: d.cost,
      reorderPoint: d.reorder,
      parLevel: d.par ?? d.reorder * 2,
      trackExpiry: d.trackExpiry ?? false,
      trackStock: true,
    },
    update: {
      category: d.category,
      categoryId: categoryId ?? null,
      defaultCost: d.cost,
      reorderPoint: d.reorder,
      parLevel: d.par ?? d.reorder * 2,
      trackExpiry: d.trackExpiry ?? false,
    },
  });

  const stock = await prisma.branchStock.findUnique({
    where: { branchId_itemId: { branchId, itemId: item.id } },
  });
  const mul = d.stockMul ?? 4;
  const targetQty = d.reorder * mul;
  const current = Number(stock?.quantity ?? 0);

  // Demo: one item low, one out
  let openQty = targetQty;
  if (d.name === "Mint leaves") openQty = Math.max(0, d.reorder - 0.5);
  if (d.name === "Prawns peeled") openQty = 0;

  if (refreshStock || current === 0) {
    const delta = openQty - current;
    if (Math.abs(delta) > 0.0001) {
      await applyStockChange({
        branchId,
        itemId: item.id,
        type: StockMovementType.ADJUSTMENT,
        quantityDelta: delta,
        unitCost: d.cost,
        reason: "Demo opening stock",
        updateAvgCost: true,
      });
    }
  }

  return item;
}

export async function seedInventoryDemo(branchId: string, options?: { refreshStock?: boolean }) {
  const refreshStock = options?.refreshStock ?? process.env.SEED_INVENTORY_REFRESH === "1";

  for (let i = 0; i < CATEGORIES.length; i++) {
    await prisma.ingredientCategory.upsert({
      where: { restaurantId_name: { restaurantId: RESTAURANT_ID, name: CATEGORIES[i] } },
      create: { name: CATEGORIES[i], sortOrder: i + 1 },
      update: { sortOrder: i + 1 },
    });
  }

  const cats = await prisma.ingredientCategory.findMany();
  const catMap = new Map(cats.map((c) => [c.name, c.id]));

  const ingByName = new Map<string, string>();
  for (const d of INGREDIENTS) {
    const item = await upsertIngredient(d, catMap.get(d.category), branchId, refreshStock);
    ingByName.set(d.name, item.id);
  }

  const supplier = await prisma.supplier.upsert({
    where: { restaurantId_name: { restaurantId: RESTAURANT_ID, name: "Metro Fresh Supplies" } },
    create: {
      name: "Metro Fresh Supplies",
      phone: "042-111-222-333",
      email: "orders@metrofresh.demo",
      address: "Wholesale Market, Industrial Area",
      paymentTerms: "Net 15",
      notes: "Demo supplier for inventory seed",
    },
    update: {},
  });

  for (const d of INGREDIENTS.slice(0, 8)) {
    const itemId = ingByName.get(d.name);
    if (!itemId) continue;
    await prisma.supplierItem.upsert({
      where: { supplierId_itemId: { supplierId: supplier.id, itemId } },
      create: { supplierId: supplier.id, itemId, lastPrice: d.cost },
      update: { lastPrice: d.cost },
    });
  }

  const menuItems = await prisma.menuItem.findMany({ select: { id: true, name: true } });
  let recipeCount = 0;

  for (const spec of RECIPES) {
    const menu = menuItems.find((m) => m.name.toLowerCase().includes(spec.match.toLowerCase()));
    if (!menu) continue;

    const lines = spec.lines.filter((l) => l.qty > 0 && ingByName.has(l.ingredient));
    if (!lines.length) continue;

    await prisma.recipeLine.deleteMany({ where: { menuItemId: menu.id } });
    await prisma.recipeLine.createMany({
      data: lines.map((l) => ({
        menuItemId: menu.id,
        itemId: ingByName.get(l.ingredient)!,
        quantity: l.qty,
      })),
    });
    await prisma.menuRecipe.upsert({
      where: { menuItemId: menu.id },
      create: { menuItemId: menu.id, yieldPortions: spec.yieldPortions ?? 1 },
      update: { yieldPortions: spec.yieldPortions ?? 1 },
    });
    recipeCount += 1;
  }

  return { ingredients: INGREDIENTS.length, recipes: recipeCount, supplierId: supplier.id };
}
