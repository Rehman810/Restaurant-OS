import { api } from "@/lib/api";
import type { InventoryItemRow, InventoryTab, InventoryUnit, StockMovementRow } from "./types";

export type { InventoryItemRow, InventoryUnit, StockMovementRow, InventoryTab };

export async function fetchInventorySummary() {
  return api<{
    metrics: { totalItems: number; totalValue: number; lowCount: number; outCount: number; expiringCount?: number };
    items: InventoryItemRow[];
    lowStock: { itemId: string; name: string; quantity: number; reorderPoint: number; unit: string }[];
    movements: StockMovementRow[];
  }>("/admin/inventory/summary");
}

export async function fetchInventoryItems(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return api<{ items: InventoryItemRow[]; total: number; page: number; pageSize: number }>(
    `/admin/inventory/items?${q}`
  );
}

export async function fetchCategories() {
  return api<{ categories: { id: string; name: string; sortOrder: number }[] }>("/admin/inventory/categories");
}

export async function createCategory(name: string) {
  return api("/admin/inventory/categories", { method: "POST", body: JSON.stringify({ name }) });
}

export async function createInventoryItem(payload: {
  name: string;
  sku?: string;
  category?: string;
  categoryId?: string;
  unit?: InventoryUnit;
  reorderPoint?: number;
  parLevel?: number;
  defaultCost?: number;
  trackExpiry?: boolean;
  openingStock?: number;
  openingCost?: number;
}) {
  return api("/admin/inventory/items", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchInventoryItem(id: string, payload: Partial<InventoryItemRow>) {
  return api(`/admin/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function adjustStock(payload: {
  itemId: string;
  mode?: "add" | "remove" | "set";
  quantity?: number;
  quantityDelta?: number;
  reason?: string;
  notes?: string;
  wasteReason?: string;
}) {
  return api<{ ok: boolean; newBalance: number }>("/admin/inventory/adjust", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchMovements(params: Record<string, string>) {
  const q = new URLSearchParams(params).toString();
  return api<{ movements: StockMovementRow[]; total: number; page: number }>(`/admin/inventory/movements?${q}`);
}

export async function fetchSuppliers(q?: string) {
  return api<{ suppliers: SupplierRow[] }>(`/admin/inventory/suppliers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
}

export type SupplierRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  paymentTerms?: string;
  notes?: string | null;
  isActive?: boolean;
};

export async function createSupplier(payload: Partial<SupplierRow>) {
  return api("/admin/inventory/suppliers", { method: "POST", body: JSON.stringify(payload) });
}

export async function patchSupplier(id: string, payload: Partial<SupplierRow>) {
  return api(`/admin/inventory/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function fetchPurchases() {
  return api<{ purchases: PurchaseRow[] }>("/admin/inventory/purchases");
}

export type PurchaseRow = {
  id: string;
  supplierName: string;
  invoiceRef: string | null;
  purchaseDate: string;
  total: number;
  paidAmount: number;
  paymentStatus: string;
  status: string;
  lineCount: number;
};

export async function receiveStock(payload: {
  supplierId?: string;
  invoiceRef?: string;
  notes?: string;
  purchaseDate?: string;
  taxAmount?: number;
  discount?: number;
  paidAmount?: number;
  lines: { itemId: string; quantity: number; unitCost?: number; expiryDate?: string; batchNo?: string }[];
}) {
  return api<{ purchaseId: string; warnings?: string[] }>("/admin/inventory/receive", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchWaste() {
  return api<{
    logs: { id: string; itemName: string; quantity: number; reason: string; costAtTime: number; loggedAt: string }[];
    totals: { today: number; week: number; month: number };
    byReason: Record<string, number>;
  }>("/admin/inventory/waste");
}

export async function logWaste(payload: {
  itemId: string;
  quantity: number;
  reason: string;
  notes?: string;
}) {
  return api("/admin/inventory/waste", { method: "POST", body: JSON.stringify(payload) });
}

export async function fetchRecipe(menuItemId: string) {
  return api<{
    yieldPortions: number;
    notes: string;
    recipeCost: number;
    price: number;
    netPrice?: number;
    marginPercent: number;
    foodCostPercent: number;
    costStatus?: string;
    missingIngredients?: string[];
    costWarning?: string | null;
    lines: { id: string; itemId: string; itemName: string; unit: InventoryUnit; quantity: number }[];
  }>(`/admin/inventory/recipes/${menuItemId}`);
}

export async function saveRecipe(
  menuItemId: string,
  payload: { lines: { itemId: string; quantity: number }[]; yieldPortions?: number; notes?: string }
) {
  return api(`/admin/inventory/recipes/${menuItemId}`, { method: "PUT", body: JSON.stringify(payload) });
}

export async function fetchMenuItemsForRecipes() {
  return api<{ items: { id: string; name: string; category: string; price: number; hasRecipe: boolean }[] }>(
    "/admin/inventory/menu-items"
  );
}

export async function fetchCounts() {
  return api<{ counts: { id: string; status: string; createdAt: string }[] }>("/admin/inventory/counts");
}

export async function fetchCount(id: string) {
  return api<{
    count: {
      id: string;
      status: string;
      branchId: string;
      lines: {
        id: string;
        itemId: string;
        itemName: string;
        unit: InventoryUnit;
        systemQty: number;
        countedQty: number | null;
        variance: number | null;
        varianceCost: number | null;
      }[];
    };
  }>(`/admin/inventory/counts/${id}`);
}

export async function startStockCount() {
  return api<{ count: { id: string; status: string } }>("/admin/inventory/counts", { method: "POST" });
}

export async function patchCountLines(countId: string, lines: { itemId: string; countedQty: number }[]) {
  return api(`/admin/inventory/counts/${countId}/lines`, {
    method: "PATCH",
    body: JSON.stringify({ lines }),
  });
}

export async function submitCount(id: string) {
  return api(`/admin/inventory/counts/${id}/submit`, { method: "POST" });
}

export async function approveCount(id: string) {
  return api(`/admin/inventory/counts/${id}/approve`, { method: "POST" });
}

export async function deleteCount(id: string) {
  return api(`/admin/inventory/counts/${id}`, { method: "DELETE" });
}

export async function convertItemToPieces(
  itemId: string,
  payload: { conversionFactor: number; preview?: boolean }
) {
  return api(`/admin/inventory/items/${itemId}/convert-to-pieces`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export type TransferRow = {
  id: string;
  status: string;
  fromBranchId: string;
  toBranchId: string;
  createdAt: string;
  lines?: { item: { name: string }; quantitySent: number; quantityReceived: number | null }[];
};

export async function fetchTransfers() {
  return api<{ transfers: TransferRow[] }>("/admin/inventory/transfers");
}

export async function createTransfer(payload: { toBranchId: string; lines: { itemId: string; quantity: number }[] }) {
  return api("/admin/inventory/transfers", { method: "POST", body: JSON.stringify(payload) });
}

export async function shipTransfer(id: string) {
  return api(`/admin/inventory/transfers/${id}/ship`, { method: "POST" });
}

export async function receiveTransfer(id: string, lines?: { itemId: string; quantityReceived: number }[]) {
  return api(`/admin/inventory/transfers/${id}/receive`, {
    method: "POST",
    body: JSON.stringify({ lines }),
  });
}

export async function fetchAlerts() {
  return api<{ lowStockCount: number; lowStock: unknown[] }>("/admin/inventory/alerts");
}

export async function fetchReorderSuggestions() {
  return api<{
    suggestions: {
      itemId: string;
      name: string;
      onHand: number;
      suggestedQty: number;
      unit?: string;
      estimatedCost?: number;
      supplierId?: string;
      supplierName?: string;
    }[];
  }>("/admin/inventory/reorder-suggestions");
}

export async function fetchValuationReport() {
  return api<{ byCategory: Record<string, number> }>("/admin/inventory/reports/valuation");
}
