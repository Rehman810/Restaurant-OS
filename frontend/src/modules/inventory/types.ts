export type InventoryUnit = "KG" | "G" | "L" | "ML" | "PIECE" | "PACK" | "DOZEN";

export type StockStatus = "ok" | "low" | "out" | "expiring";

export type InventoryItemRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  categoryId: string | null;
  unit: InventoryUnit;
  reorderPoint: number;
  parLevel: number | null;
  defaultCost?: number;
  avgCost: number;
  trackStock: boolean;
  trackExpiry: boolean;
  quantity: number;
  stockValue: number;
  isActive?: boolean;
  status: StockStatus;
};

export type StockMovementRow = {
  id: string;
  type: string;
  itemId?: string;
  itemName: string;
  unit?: InventoryUnit;
  quantityDelta: number;
  quantityAfter: number;
  unitCost?: number | null;
  reason: string | null;
  reference: string | null;
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  actorId: string | null;
  createdAt: string;
};

export type InventoryTab =
  | "stock"
  | "receive"
  | "recipes"
  | "waste"
  | "suppliers"
  | "movements"
  | "counts"
  | "transfers"
  | "reports";

export const INVENTORY_TABS: { id: InventoryTab; label: string; short?: string }[] = [
  { id: "stock", label: "Stock", short: "Stock" },
  { id: "receive", label: "Receive", short: "Recv" },
  { id: "recipes", label: "Recipes", short: "BOM" },
  { id: "waste", label: "Waste", short: "Waste" },
  { id: "suppliers", label: "Suppliers", short: "Supp" },
  { id: "movements", label: "Movements", short: "Ledger" },
  { id: "counts", label: "Counts", short: "Count" },
  { id: "transfers", label: "Transfers", short: "Xfer" },
  { id: "reports", label: "Reports", short: "Rpt" },
];
