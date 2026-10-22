"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Copy,
  MessageCircle,
  PackagePlus,
  Plus,
  Truck,
  Trash2,
  UtensilsCrossed,
  Users,
  X,
} from "lucide-react";
import { INVENTORY_TAB_HELP } from "./help";
import {
  DateInput,
  EmptyRow,
  Field,
  IngredientPicker,
  InventoryPanel,
  InventoryTable,
  MetricCard,
  Modal,
  MovementTypePill,
  PaymentPill,
  SearchField,
  Segment,
  SelectField,
  TabHelp,
  TablePagination,
  TextInput,
  StatusChip,
  DetailDrawer,
  InventoryEmptyState,
  RowActionsMenu,
  SearchableSelect,
} from "./components/primitives";
import { AdminScopeBanner } from "@/components/admin/AdminScopeBanner";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { InputSheet } from "@/components/admin/InputSheet";
import { AdminAlert, AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { useBranch } from "@/modules/branches/BranchContext";
import { pkr } from "@/lib/format";
import { formatInventoryWhen, formatQty } from "./format";
import { LOW_FOOD_COST_PCT } from "@/lib/costing/helpers";
import {
  adjustStock,
  approveCount,
  deleteCount,
  createCategory,
  createInventoryItem,
  createSupplier,
  createTransfer,
  fetchCategories,
  fetchCount,
  fetchCounts,
  fetchInventorySummary,
  fetchMenuItemsForRecipes,
  fetchMovements,
  fetchPurchases,
  fetchRecipe,
  fetchReorderSuggestions,
  fetchSupplierLedger,
  fetchSuppliers,
  fetchTransfers,
  fetchValuationReport,
  fetchWaste,
  movementsExportUrl,
  recordSupplierPayment,
  logWaste,
  patchCountLines,
  patchInventoryItem,
  receiveStock,
  receiveTransfer,
  saveRecipe,
  shipTransfer,
  startStockCount,
  submitCount,
  type InventoryItemRow,
  type InventoryTab,
  type InventoryUnit,
  type PurchaseRow,
  type StockMovementRow,
  type TransferRow,
} from "./api";
import { INVENTORY_TABS } from "./types";

const UNITS: InventoryUnit[] = ["KG", "G", "L", "ML", "PIECE", "PACK", "DOZEN"];
const WASTE_REASONS = [
  { value: "EXPIRED", label: "Expired" },
  { value: "SPOILED", label: "Spoiled" },
  { value: "DROPPED", label: "Dropped / damaged" },
  { value: "OVER_PREPARED", label: "Overproduction" },
  { value: "STAFF_MEAL", label: "Staff meal" },
  { value: "OTHER", label: "Other" },
];

function wasteReasonLabel(code: string) {
  return WASTE_REASONS.find((r) => r.value === code)?.label ?? code.replace(/_/g, " ");
}

function countStatusClass(status: string) {
  if (status === "DRAFT") return "bg-stone-200 text-stone-800 dark:bg-stone-700 dark:text-stone-100";
  if (status === "SUBMITTED") return "bg-amber-100 text-amber-900";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800";
  return "bg-stone-100 text-stone-700";
}
const DEFAULT_STOCK_PAGE_SIZE = 15;

function stockStatusOrder(status: InventoryItemRow["status"]) {
  if (status === "out") return 0;
  if (status === "low") return 1;
  if (status === "expiring") return 2;
  return 3;
}

function ParLevelBar({ quantity, parLevel }: { quantity: number; parLevel: number | null }) {
  if (parLevel == null || parLevel <= 0) return null;
  const pct = Math.min(100, Math.max(0, (quantity / parLevel) * 100));
  return (
    <div
      className="mt-1.5 h-1.5 w-full max-w-[88px] overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"
      title={`${Math.round(pct)}% of par (${parLevel})`}
    >
      <div
        className={`h-full rounded-full transition-all ${pct <= 25 ? "bg-red-500" : pct <= 50 ? "bg-amber-500" : "bg-emerald-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function statusBadge(status: InventoryItemRow["status"]) {
  if (status === "out") return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200";
  if (status === "low") return "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100";
  if (status === "expiring") return "bg-purple-100 text-purple-900 dark:bg-purple-950/50 dark:text-purple-100";
  return "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100";
}

function statusLabel(status: InventoryItemRow["status"]) {
  if (status === "out") return "Out";
  if (status === "low") return "Low";
  if (status === "expiring") return "Expiring";
  return "OK";
}

const TAB_ICONS: Record<InventoryTab, typeof Boxes> = {
  stock: Boxes,
  receive: PackagePlus,
  recipes: UtensilsCrossed,
  waste: Trash2,
  suppliers: Users,
  movements: ClipboardList,
  counts: ClipboardList,
  transfers: Truck,
  reports: BarChart3,
};

export function InventoryModule() {
  const { selection, branches, activeBranch } = useBranch();
  const branchRequired = selection === "all";
  const router = useRouter();
  const search = useSearchParams();
  const tab = (search.get("tab") as InventoryTab) || "stock";
  const setTab = (id: InventoryTab) => router.replace(`/admin/inventory?tab=${id}`, { scroll: false });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [metrics, setMetrics] = useState({ totalItems: 0, totalValue: 0, lowCount: 0, outCount: 0, expiringCount: 0 });
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [movements, setMovements] = useState<
    { id: string; type: string; itemName: string; unit?: string; quantityDelta: number; reference?: string | null; createdAt: string }[]
  >([]);
  const [newIngredientOpen, setNewIngredientOpen] = useState(false);
  const [stockDetailItem, setStockDetailItem] = useState<InventoryItemRow | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState(() =>
    search.get("stock") === "low" ? "low" : "all"
  );
  const [categoryFilter, setCategoryFilter] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [stockPage, setStockPage] = useState(1);
  const [stockPageSize, setStockPageSize] = useState(DEFAULT_STOCK_PAGE_SIZE);

  const [adjustItem, setAdjustItem] = useState<InventoryItemRow | null>(null);
  const [adjustMode, setAdjustMode] = useState<"add" | "remove" | "set">("add");
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("Count correction");
  const [adjustBusy, setAdjustBusy] = useState(false);

  const [newName, setNewName] = useState("");
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newUnit, setNewUnit] = useState<InventoryUnit>("KG");
  const [newReorder, setNewReorder] = useState("5");
  const [newPar, setNewPar] = useState("");
  const [newOpening, setNewOpening] = useState("");
  const [newCost, setNewCost] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [suppliers, setSuppliers] = useState<{ id: string; name: string; phone?: string; email?: string }[]>([]);
  const [recvSupplier, setRecvSupplier] = useState("");
  const [recvInvoice, setRecvInvoice] = useState("");
  const [recvDate, setRecvDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recvTax, setRecvTax] = useState("0");
  const [recvDiscount, setRecvDiscount] = useState("0");
  const [recvPaymentMode, setRecvPaymentMode] = useState<"full" | "credit" | "partial">("full");
  const [recvPartialPaid, setRecvPartialPaid] = useState("");
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRow | null>(null);
  const [recvLines, setRecvLines] = useState<{ itemId: string; quantity: string; unitCost: string; expiryDate: string }[]>([
    { itemId: "", quantity: "", unitCost: "", expiryDate: "" },
  ]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [receiveView, setReceiveView] = useState<"new" | "history">("new");

  const [menuItems, setMenuItems] = useState<{ id: string; name: string; price: number; hasRecipe: boolean }[]>([]);
  const [recipeMenuFilter, setRecipeMenuFilter] = useState("");
  const [recipeFilterMode, setRecipeFilterMode] = useState<"all" | "missing" | "has" | "review">("all");
  const [menuFoodCostMap, setMenuFoodCostMap] = useState<Record<string, number>>({});
  const [recipeLineUnits, setRecipeLineUnits] = useState<Record<string, InventoryUnit>>({});
  const [recipeMenuId, setRecipeMenuId] = useState("");
  const [recipeLines, setRecipeLines] = useState<{ itemId: string; quantity: string }[]>([]);
  const [recipeYield, setRecipeYield] = useState("1");
  const [recipeMeta, setRecipeMeta] = useState({
    recipeCost: 0,
    marginPercent: 0,
    foodCostPercent: 0,
    price: 0,
    costWarning: null as string | null,
  });

  const [wasteItem, setWasteItem] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("EXPIRED");
  const [wasteData, setWasteData] = useState<{
    logs: { itemName: string; quantity: number; reason: string; costAtTime: number; loggedAt: string }[];
    totals: { today: number; week: number; month: number };
    byReason: Record<string, number>;
  } | null>(null);

  const [ledger, setLedger] = useState<StockMovementRow[]>([]);
  const [counts, setCounts] = useState<{ id: string; status: string; createdAt: string }[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [transferTo, setTransferTo] = useState("");
  const [transferLines, setTransferLines] = useState<{ itemId: string; quantity: string }[]>([{ itemId: "", quantity: "" }]);

  const [movementType, setMovementType] = useState("");
  const [movementItem, setMovementItem] = useState("");
  const [movementFrom, setMovementFrom] = useState("");
  const [movementTo, setMovementTo] = useState("");
  const [movementDatePreset, setMovementDatePreset] = useState<"" | "today" | "7d" | "30d">("");
  const [purchaseSupplierFilter, setPurchaseSupplierFilter] = useState("");

  const [activeCountId, setActiveCountId] = useState("");
  const [countDetail, setCountDetail] = useState<
    { itemId: string; itemName: string; unit: string; systemQty: number; countedQty: string }[]
  >([]);
  const [showSystemOnCount, setShowSystemOnCount] = useState(false);

  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [supplierModal, setSupplierModal] = useState(false);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supEmail, setSupEmail] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supTerms, setSupTerms] = useState("");
  const [valuation, setValuation] = useState<Record<string, number>>({});
  const [suggestions, setSuggestions] = useState<
    { name: string; suggestedQty: number; unit?: string; estimatedCost?: number; supplierName?: string; itemId: string }[]
  >([]);
  const [archiveTarget, setArchiveTarget] = useState<InventoryItemRow | null>(null);
  const [supplierDetailId, setSupplierDetailId] = useState<string | null>(null);
  const [supplierLedger, setSupplierLedger] = useState<Awaited<ReturnType<typeof fetchSupplierLedger>> | null>(null);
  const [supplierBalances, setSupplierBalances] = useState<Record<string, number>>({});
  const [supplierPayAmount, setSupplierPayAmount] = useState("");
  const [supplierPayMethod, setSupplierPayMethod] = useState("CASH");
  const [transferStatusFilter, setTransferStatusFilter] = useState<"all" | "PENDING" | "IN_TRANSIT" | "RECEIVED">("all");
  const [wasteNote, setWasteNote] = useState("");

  const filteredMenuItems = useMemo(() => {
    let list = menuItems;
    const q = recipeMenuFilter.trim().toLowerCase();
    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
    if (recipeFilterMode === "missing") list = list.filter((m) => !m.hasRecipe);
    if (recipeFilterMode === "has") list = list.filter((m) => m.hasRecipe);
    if (recipeFilterMode === "review") {
      list = list.filter((m) => {
        if (!m.hasRecipe) return true;
        const fc = menuFoodCostMap[m.id];
        return fc != null && fc < LOW_FOOD_COST_PCT;
      });
    }
    return list;
  }, [menuItems, recipeMenuFilter, recipeFilterMode, menuFoodCostMap]);

  const recvSubtotal = useMemo(
    () =>
      recvLines.reduce((s, l) => {
        const q = Number(l.quantity) || 0;
        const c = Number(l.unitCost) || 0;
        return s + q * c;
      }, 0),
    [recvLines]
  );

  const recvTotal = useMemo(() => recvSubtotal + (Number(recvTax) || 0) - (Number(recvDiscount) || 0), [recvSubtotal, recvTax, recvDiscount]);

  const recvPaidAmount = useMemo(() => {
    if (recvPaymentMode === "full") return recvTotal;
    if (recvPaymentMode === "credit") return 0;
    return Math.min(recvTotal, Math.max(0, Number(recvPartialPaid) || 0));
  }, [recvPaymentMode, recvPartialPaid, recvTotal]);

  const filteredPurchases = useMemo(() => {
    if (!purchaseSupplierFilter) return purchases;
    const sup = suppliers.find((s) => s.id === purchaseSupplierFilter);
    if (!sup) return purchases;
    return purchases.filter((p) => p.supplierName === sup.name);
  }, [purchases, purchaseSupplierFilter, suppliers]);

  const filteredTransfers = useMemo(() => {
    if (transferStatusFilter === "all") return transfers;
    return transfers.filter((t) => t.status === transferStatusFilter);
  }, [transfers, transferStatusFilter]);

  const transferDestinations = useMemo(() => branches.filter((b) => b.id !== selection), [branches, selection]);

  const topStockByValue = useMemo(() => [...items].sort((a, b) => b.stockValue - a.stockValue).slice(0, 10), [items]);

  const deadStockItems = useMemo(
    () => items.filter((i) => i.isActive !== false && i.quantity > 0 && i.status === "ok").sort((a, b) => a.stockValue - b.stockValue).slice(0, 8),
    [items]
  );

  const groupedReorder = useMemo(() => {
    const map = new Map<string, typeof suggestions>();
    for (const s of suggestions) {
      const key = s.supplierName?.trim() || "No supplier";
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [suggestions]);

  const movementExportHref = useMemo(() => {
    const params: Record<string, string> = {};
    if (movementType) params.type = movementType;
    if (movementItem) params.itemId = movementItem;
    if (movementFrom) params.from = movementFrom;
    if (movementTo) params.to = movementTo;
    return movementsExportUrl(params);
  }, [movementType, movementItem, movementFrom, movementTo]);

  const totalSupplierPayable = useMemo(
    () => Object.values(supplierBalances).reduce((s, v) => s + (v > 0 ? v : 0), 0),
    [supplierBalances]
  );

  function applyMovementDatePreset(preset: "" | "today" | "7d" | "30d") {
    setMovementDatePreset(preset);
    if (!preset) {
      setMovementFrom("");
      setMovementTo("");
      return;
    }
    const to = new Date();
    const from = new Date();
    if (preset === "today") {
      /* same day */
    } else if (preset === "7d") from.setDate(from.getDate() - 6);
    else from.setDate(from.getDate() - 29);
    setMovementFrom(from.toISOString().slice(0, 10));
    setMovementTo(to.toISOString().slice(0, 10));
  }

  function copyReorderList(lines: typeof suggestions) {
    const text = lines.map((s) => `${s.name}: ${formatQty(s.suggestedQty, s.unit ?? "PIECE")}`).join("\n");
    void navigator.clipboard.writeText(text);
    setMsg("Order list copied.");
  }

  function whatsappReorderList(lines: typeof suggestions, supplierName: string) {
    const body = `Reorder (${supplierName})\n\n${lines.map((s) => `• ${s.name} — ${formatQty(s.suggestedQty, s.unit ?? "PIECE")}`).join("\n")}`;
    const url = `https://wa.me/?text=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const valuationChart = useMemo(
    () => Object.entries(valuation).map(([name, value]) => ({ name, value })),
    [valuation]
  );

  const reloadMovements = useCallback(async () => {
    const params: Record<string, string> = { page: "1", pageSize: "50" };
    if (movementType) params.type = movementType;
    if (movementItem) params.itemId = movementItem;
    const data = await fetchMovements(params);
    let rows = data.movements;
    if (movementFrom) {
      const from = new Date(movementFrom);
      rows = rows.filter((m) => new Date(m.createdAt) >= from);
    }
    if (movementTo) {
      const to = new Date(movementTo);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((m) => new Date(m.createdAt) <= to);
    }
    setLedger(rows);
  }, [movementType, movementItem, movementFrom, movementTo]);

  const filteredItems = useMemo(() => {
    let rows = items;
    const q = searchQ.trim().toLowerCase();
    if (q) rows = rows.filter((i) => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    if (statusFilter !== "all") rows = rows.filter((i) => i.status === statusFilter);
    if (categoryFilter) rows = rows.filter((i) => i.category === categoryFilter);
    if (!showArchived) rows = rows.filter((i) => i.isActive !== false);
    rows.sort((a, b) => {
      const d = stockStatusOrder(a.status) - stockStatusOrder(b.status);
      if (d !== 0) return d;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [items, searchQ, statusFilter, categoryFilter, showArchived]);

  const stockTotalPages = Math.max(1, Math.ceil(filteredItems.length / stockPageSize));
  const stockPageSafe = Math.min(stockPage, stockTotalPages);

  const paginatedStockItems = useMemo(() => {
    const start = (stockPageSafe - 1) * stockPageSize;
    return filteredItems.slice(start, start + stockPageSize);
  }, [filteredItems, stockPageSafe, stockPageSize]);

  const pickerItems = useMemo(
    () =>
      items.map((i) => ({
        id: i.id,
        name: i.name,
        unit: i.unit,
        quantity: i.quantity,
        status: i.status,
      })),
    [items]
  );

  useEffect(() => {
    setStockPage(1);
  }, [searchQ, statusFilter, categoryFilter, showArchived, stockPageSize]);

  useEffect(() => {
    if (stockPage > stockTotalPages) setStockPage(stockTotalPages);
  }, [stockPage, stockTotalPages]);

  const load = useCallback(async () => {
    if (branchRequired) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await fetchInventorySummary();
      setItems(data.items);
      setMetrics({
        ...data.metrics,
        expiringCount: data.metrics.expiringCount ?? 0,
      });
      setMovements(data.movements);
      const [cats, sup] = await Promise.all([fetchCategories(), fetchSuppliers()]);
      setCategories(cats.categories);
      setSuppliers(sup.suppliers);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inventory");
    } finally {
      setLoading(false);
    }
  }, [branchRequired]);

  useEffect(() => {
    void load();
  }, [load, selection]);

  useEffect(() => {
    if (branchRequired) return;
    const onTabError = (err: unknown) => {
      setError(err instanceof Error ? err.message : "Could not load tab data");
    };
    if (tab === "receive") {
      void fetchPurchases()
        .then((d) => setPurchases(d.purchases))
        .catch(onTabError);
    }
    if (tab === "recipes") {
      void fetchMenuItemsForRecipes()
        .then((d) => setMenuItems(d.items))
        .catch(onTabError);
    }
    if (tab === "waste") {
      void fetchWaste().then(setWasteData).catch(onTabError);
    }
    if (tab === "movements") void reloadMovements();
    if (tab === "counts") {
      void fetchCounts()
        .then((d) => setCounts(d.counts))
        .catch(onTabError);
    }
    if (tab === "transfers") {
      void fetchTransfers()
        .then((d) => setTransfers(d.transfers))
        .catch(onTabError);
    }
    if (tab === "reports") {
      void fetchValuationReport()
        .then((d) => setValuation(d.byCategory))
        .catch(onTabError);
      void fetchReorderSuggestions()
        .then((d) => setSuggestions(d.suggestions))
        .catch(onTabError);
    }
    if (tab === "suppliers" && suppliers.length > 0) {
      void Promise.all(
        suppliers.map(async (s) => {
          try {
            const led = await fetchSupplierLedger(s.id);
            return [s.id, led.balanceDue] as const;
          } catch {
            return [s.id, 0] as const;
          }
        })
      ).then((rows) => setSupplierBalances(Object.fromEntries(rows)));
    }
  }, [tab, selection, reloadMovements, branchRequired, suppliers]);

  useEffect(() => {
    if (!supplierDetailId) {
      setSupplierLedger(null);
      return;
    }
    void fetchSupplierLedger(supplierDetailId)
      .then(setSupplierLedger)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load ledger"));
  }, [supplierDetailId]);

  useEffect(() => {
    if (tab === "movements") void reloadMovements();
  }, [movementType, movementItem, movementFrom, movementTo, tab, reloadMovements]);

  useEffect(() => {
    if (!activeCountId) {
      setCountDetail([]);
      return;
    }
    void fetchCount(activeCountId).then((d) => {
      setCountDetail(
        d.count.lines.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          unit: l.unit,
          systemQty: l.systemQty,
          countedQty: l.countedQty != null ? String(l.countedQty) : "",
        }))
      );
    });
  }, [activeCountId]);

  useEffect(() => {
    if (!recipeMenuId) {
      setRecipeLines([]);
      return;
    }
    void fetchRecipe(recipeMenuId)
      .then((d) => {
        setRecipeYield(String(d.yieldPortions));
        setRecipeMeta({
          recipeCost: d.recipeCost,
          marginPercent: d.marginPercent,
          foodCostPercent: d.foodCostPercent,
          price: d.price,
          costWarning: d.costWarning ?? null,
        });
        setMenuFoodCostMap((prev) => ({ ...prev, [recipeMenuId]: d.foodCostPercent }));
        const units: Record<string, InventoryUnit> = {};
        for (const l of d.lines) {
          if (l.itemId && l.unit) units[l.itemId] = l.unit as InventoryUnit;
        }
        setRecipeLineUnits(units);
        setRecipeLines(
          d.lines.length ? d.lines.map((l) => ({ itemId: l.itemId, quantity: String(l.quantity) })) : [{ itemId: "", quantity: "" }]
        );
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load recipe");
      });
  }, [recipeMenuId]);

  async function onAddItem(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createInventoryItem({
        name: newName.trim(),
        categoryId: newCategoryId || undefined,
        unit: newUnit,
        reorderPoint: Number(newReorder) || 0,
        parLevel: newPar ? Number(newPar) : undefined,
        openingStock: newOpening ? Number(newOpening) : undefined,
        openingCost: newCost ? Number(newCost) : undefined,
        defaultCost: newCost ? Number(newCost) : undefined,
      });
      setMsg("Ingredient added.");
      setNewName("");
      setNewOpening("");
      setNewIngredientOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item");
    }
  }

  async function onAdjustSubmit(e: FormEvent) {
    e.preventDefault();
    if (!adjustItem) return;
    setAdjustBusy(true);
    try {
      const isWaste = /wastage|damage|staff meal/i.test(adjustReason);
      await adjustStock({
        itemId: adjustItem.id,
        mode: adjustMode,
        quantity: Number(adjustQty),
        reason: adjustReason,
        ...(isWaste ? { wasteReason: "OTHER" } : {}),
      });
      setMsg("Stock updated.");
      setAdjustItem(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    } finally {
      setAdjustBusy(false);
    }
  }

  const previewBalance = useMemo(() => {
    if (!adjustItem) return 0;
    const q = Number(adjustQty) || 0;
    const cur = adjustItem.quantity;
    if (adjustMode === "add") return cur + q;
    if (adjustMode === "remove") return cur - q;
    return q;
  }, [adjustItem, adjustMode, adjustQty]);

  async function onReceive(e: FormEvent) {
    e.preventDefault();
    const lines = recvLines
      .filter((l) => l.itemId && Number(l.quantity) > 0)
      .map((l) => ({
        itemId: l.itemId,
        quantity: Number(l.quantity),
        unitCost: l.unitCost ? Number(l.unitCost) : undefined,
        expiryDate: l.expiryDate || undefined,
      }));
    if (!lines.length) return;
    try {
      const sub = lines.reduce((s, l) => s + l.quantity * (l.unitCost ?? 0), 0);
      const tax = Number(recvTax) || 0;
      const disc = Number(recvDiscount) || 0;
      const total = sub + tax - disc;
      const res = await receiveStock({
        supplierId: recvSupplier || undefined,
        invoiceRef: recvInvoice || undefined,
        purchaseDate: recvDate,
        taxAmount: tax,
        discount: disc,
        paidAmount: recvPaidAmount,
        lines,
      });
      if (res.warnings?.length) setMsg(`Received. ${res.warnings.join(" ")}`);
      else setMsg("Stock received.");
      setRecvLines([{ itemId: "", quantity: "", unitCost: "", expiryDate: "" }]);
      await load();
      void fetchPurchases().then((d) => setPurchases(d.purchases));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Receive failed");
    }
  }

  const wasteChart = useMemo(() => {
    if (!wasteData) return [];
    return Object.entries(wasteData.byReason).map(([name, value]) => ({ name: wasteReasonLabel(name), value }));
  }, [wasteData]);

  const wasteMonthPct = useMemo(() => {
    if (!wasteData || metrics.totalValue <= 0) return null;
    return (wasteData.totals.month / metrics.totalValue) * 100;
  }, [wasteData, metrics.totalValue]);

  const countVarianceValue = useMemo(
    () =>
      countDetail.reduce((s, line) => {
        if (!line.countedQty) return s;
        const ing = items.find((i) => i.id === line.itemId);
        const varQty = (Number(line.countedQty) || 0) - line.systemQty;
        return s + varQty * (ing?.avgCost ?? 0);
      }, 0),
    [countDetail, items]
  );

  return (
    <AdminPage>
      <AdminScopeBanner variant="branch" />
      <AdminPageHeader
        title="Inventory"
        description="Stock, purchases, recipes, waste, and branch transfers."
        trailing={
          !branchRequired ? (
            <TabHelp title={INVENTORY_TAB_HELP[tab].title} bullets={INVENTORY_TAB_HELP[tab].bullets} />
          ) : undefined
        }
        actions={<RefreshButton busy={loading} onClick={() => load()} />}
      />

      {branchRequired && (
        <AdminAlert variant="warning">
          Select <strong>one branch</strong> in the header — stock is tracked per branch.
        </AdminAlert>
      )}

      {error && <AdminAlert variant="error">{error}</AdminAlert>}
      {msg && <AdminAlert variant="success">{msg}</AdminAlert>}

      {!branchRequired && (
        <>
          <div className="flex flex-wrap gap-1.5">
              {INVENTORY_TABS.map((t) => {
                const Icon = TAB_ICONS[t.id];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold sm:px-3 sm:py-2.5 sm:text-sm ${
                      tab === t.id
                        ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                        : "bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300"
                    }`}
                  >
                    <Icon size={16} className="shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">{t.label}</span>
                  </button>
                );
              })}
          </div>

          {tab === "stock" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard label="Total items" value={metrics.totalItems} onClick={() => setStatusFilter("all")} />
                <MetricCard label="Stock value" value={pkr(metrics.totalValue)} />
                <MetricCard label="Low stock" value={metrics.lowCount} accent="amber" onClick={() => setStatusFilter("low")} />
                <MetricCard label="Out of stock" value={metrics.outCount} accent="red" onClick={() => setStatusFilter("out")} />
                <MetricCard label="Expiring (7d)" value={metrics.expiringCount} onClick={() => setStatusFilter("expiring")} />
              </div>

              <div className="grid gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3 dark:border-stone-700 dark:bg-stone-800/30 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
                <SearchField
                  value={searchQ}
                  onChange={setSearchQ}
                  placeholder="Search name or category…"
                  className="sm:col-span-2 lg:col-span-1"
                />
                <SelectField
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: "all", label: "All statuses" },
                    { value: "low", label: "Low stock" },
                    { value: "out", label: "Out of stock" },
                    { value: "expiring", label: "Expiring soon" },
                  ]}
                  className="min-w-0 w-full"
                />
                <SelectField
                  label="Category"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[
                    { value: "", label: "All categories" },
                    ...categories.map((c) => ({ value: c.name, label: c.name })),
                  ]}
                  className="min-w-0 w-full"
                />
                <label className="flex items-center gap-2 pb-0.5 text-xs font-medium text-stone-600 sm:col-span-2 lg:col-span-1 lg:justify-self-start lg:pb-2 dark:text-stone-400">
                  <input type="checkbox" className="rounded border-stone-300" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                  Archived
                </label>
              </div>

              <InventoryPanel
                title="Ingredients"
                description={`${filteredItems.length} items · ${activeBranch?.name ?? "branch"}`}
                action={
                  <button type="button" className="btn-primary text-xs sm:text-sm" onClick={() => setNewIngredientOpen(true)}>
                    <Plus size={16} className="mr-1 inline" aria-hidden />
                    New ingredient
                  </button>
                }
              >
                <InventoryTable
                  columns={["Item", "On hand", "Level", "Reorder", "Avg cost", "Value", "Status", ""]}
                  loading={loading}
                  bodyMaxHeight="min(52vh, 560px)"
                >
                  {paginatedStockItems.map((i) => (
                    <tr
                      key={i.id}
                      className="cursor-pointer hover:bg-stone-50/80 dark:hover:bg-stone-800/40"
                      onClick={() => setStockDetailItem(i)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-stone-900 dark:text-stone-100">{i.name}</p>
                        <p className="text-xs text-stone-400">{i.category}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm tabular-nums">{formatQty(i.quantity, i.unit)}</td>
                      <td className="px-4 py-3">
                        <ParLevelBar quantity={i.quantity} parLevel={i.parLevel} />
                      </td>
                      <td className="px-4 py-3 text-sm text-stone-500">{formatQty(i.reorderPoint, i.unit)}</td>
                      <td className="px-4 py-3 text-sm">{pkr(i.avgCost)}</td>
                      <td className="px-4 py-3 text-sm font-medium">{pkr(i.stockValue)}</td>
                      <td className="px-4 py-3">
                        <StatusChip status={i.status} />
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <RowActionsMenu
                          actions={[
                            { label: "Adjust stock", onClick: () => { setAdjustItem(i); setAdjustQty(""); } },
                            { label: "View movements", onClick: () => { setMovementItem(i.id); setTab("movements"); } },
                            { label: "Log waste", onClick: () => { setWasteItem(i.id); setTab("waste"); } },
                            { label: "Archive", danger: true, onClick: () => setArchiveTarget(i) },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                  {!loading && filteredItems.length === 0 && (
                    <EmptyRow colSpan={8}>
                      <InventoryEmptyState
                        title="No ingredients match"
                        description="Add your first ingredient or clear filters."
                        action={
                          <button type="button" className="btn-primary text-sm" onClick={() => setNewIngredientOpen(true)}>
                            + New ingredient
                          </button>
                        }
                      />
                    </EmptyRow>
                  )}
                </InventoryTable>
                {!loading && filteredItems.length > 0 && (
                  <TablePagination
                    page={stockPageSafe}
                    pageSize={stockPageSize}
                    total={filteredItems.length}
                    onPageChange={setStockPage}
                    onPageSizeChange={setStockPageSize}
                  />
                )}
              </InventoryPanel>

              <InventoryPanel title="Recent movements" action={<button type="button" className="text-xs font-bold text-brand-600" onClick={() => setTab("movements")}>View ledger</button>}>
                <ul className="max-h-52 space-y-2 overflow-y-auto text-sm">
                  {movements.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 dark:bg-stone-800/50">
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{m.itemName}</span>{" "}
                        <MovementTypePill type={m.type} />
                        {m.reference && <span className="ml-1 text-xs text-stone-400">· {m.reference}</span>}
                      </span>
                      <span className="shrink-0 font-mono text-xs tabular-nums">
                        {m.quantityDelta > 0 ? "+" : ""}
                        {m.unit ? formatQty(m.quantityDelta, m.unit) : m.quantityDelta}
                      </span>
                    </li>
                  ))}
                  {movements.length === 0 && <p className="text-center text-xs text-stone-400">No movements yet.</p>}
                </ul>
              </InventoryPanel>

              <DetailDrawer open={newIngredientOpen} title="New ingredient" onClose={() => setNewIngredientOpen(false)}>
                <form onSubmit={onAddItem} className="space-y-3">
                  <Field label="Name" required>
                    <TextInput value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </Field>
                  <SelectField
                    label="Category"
                    value={newCategoryId}
                    onChange={setNewCategoryId}
                    options={[{ value: "", label: "General" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                  />
                  <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => setCategorySheetOpen(true)}>
                    + New category
                  </button>
                  <SelectField label="Unit" value={newUnit} onChange={(v) => setNewUnit(v as InventoryUnit)} options={UNITS.map((u) => ({ value: u, label: u }))} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Reorder at"><TextInput value={newReorder} onChange={(e) => setNewReorder(e.target.value)} inputMode="decimal" /></Field>
                    <Field label="Par level"><TextInput value={newPar} onChange={(e) => setNewPar(e.target.value)} inputMode="decimal" /></Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Opening qty"><TextInput value={newOpening} onChange={(e) => setNewOpening(e.target.value)} inputMode="decimal" /></Field>
                    <Field label="Cost / unit"><TextInput value={newCost} onChange={(e) => setNewCost(e.target.value)} inputMode="decimal" /></Field>
                  </div>
                  <button type="submit" className="btn-primary w-full">Save ingredient</button>
                </form>
              </DetailDrawer>

              <DetailDrawer open={Boolean(stockDetailItem)} title={stockDetailItem?.name ?? "Item"} onClose={() => setStockDetailItem(null)}>
                {stockDetailItem && (
                  <div className="space-y-4 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={stockDetailItem.status} />
                      <span className="text-stone-500">{stockDetailItem.category}</span>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                      <div><dt className="text-xs text-stone-500">On hand</dt><dd className="font-mono font-semibold">{formatQty(stockDetailItem.quantity, stockDetailItem.unit)}</dd></div>
                      <div><dt className="text-xs text-stone-500">Value</dt><dd className="font-semibold">{pkr(stockDetailItem.stockValue)}</dd></div>
                      <div><dt className="text-xs text-stone-500">Avg cost</dt><dd>{pkr(stockDetailItem.avgCost)}</dd></div>
                      <div><dt className="text-xs text-stone-500">Reorder at</dt><dd>{formatQty(stockDetailItem.reorderPoint, stockDetailItem.unit)}</dd></div>
                    </dl>
                    <ParLevelBar quantity={stockDetailItem.quantity} parLevel={stockDetailItem.parLevel} />
                    <div className="flex flex-col gap-2">
                      <button type="button" className="btn-primary" onClick={() => { setAdjustItem(stockDetailItem); setAdjustQty(""); setStockDetailItem(null); }}>Adjust stock</button>
                      <button type="button" className="btn-secondary" onClick={() => { setMovementItem(stockDetailItem.id); setTab("movements"); setStockDetailItem(null); }}>View movements</button>
                      <button type="button" className="btn-secondary" onClick={() => { setWasteItem(stockDetailItem.id); setTab("waste"); setStockDetailItem(null); }}>Log waste</button>
                    </div>
                  </div>
                )}
              </DetailDrawer>
            </>
          )}

          {tab === "receive" && (
            <div className="space-y-4">
              <Segment value={receiveView} onChange={setReceiveView} options={[{ id: "new", label: "New purchase" }, { id: "history", label: "Purchase history" }]} />
              {receiveView === "history" ? (
                <InventoryPanel title="Purchase history" description="Tap a row for invoice details">
                  <div className="mb-3 max-w-xs">
                    <SelectField
                      label="Supplier"
                      value={purchaseSupplierFilter}
                      onChange={setPurchaseSupplierFilter}
                      options={[{ value: "", label: "All suppliers" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]}
                    />
                  </div>
                  <InventoryTable columns={["Date", "Supplier", "Invoice", "Total", "Paid", "Due", "Payment"]}>
                    {filteredPurchases.map((p) => {
                      const due = Math.max(0, p.total - p.paidAmount);
                      return (
                        <tr
                          key={p.id}
                          className="cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/40"
                          onClick={() => setSelectedPurchase(p)}
                        >
                          <td className="px-4 py-2 whitespace-nowrap">{new Date(p.purchaseDate).toLocaleDateString()}</td>
                          <td className="px-4 py-2">{p.supplierName}</td>
                          <td className="px-4 py-2 font-mono text-xs">{p.invoiceRef || "—"}</td>
                          <td className="px-4 py-2 font-medium">{pkr(p.total)}</td>
                          <td className="px-4 py-2 text-stone-600">{pkr(p.paidAmount)}</td>
                          <td className="px-4 py-2">{due > 0 ? <span className="font-medium text-amber-700">{pkr(due)}</span> : "—"}</td>
                          <td className="px-4 py-2"><PaymentPill status={p.paymentStatus} /></td>
                        </tr>
                      );
                    })}
                    {filteredPurchases.length === 0 && <EmptyRow colSpan={7}>No purchases recorded yet.</EmptyRow>}
                  </InventoryTable>
                </InventoryPanel>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <InventoryPanel title="Receive stock" description="Posts inventory in and updates weighted average cost">
                    <form onSubmit={onReceive} className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <SelectField label="Supplier" value={recvSupplier} onChange={setRecvSupplier} options={[{ value: "", label: "No supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
                        <Field label="Invoice / GRN #"><TextInput value={recvInvoice} onChange={(e) => setRecvInvoice(e.target.value)} /></Field>
                        <DateInput label="Purchase date" value={recvDate} onChange={setRecvDate} />
                      </div>
                      <div className="space-y-2 rounded-xl border border-dashed border-stone-200 p-3 dark:border-stone-700">
                        <p className="text-xs font-bold uppercase tracking-wide text-stone-400">Line items</p>
                        {recvLines.map((line, idx) => {
                          const item = items.find((i) => i.id === line.itemId);
                          const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitCost) || 0);
                          return (
                            <div key={idx} className="grid gap-2 lg:grid-cols-12 lg:items-end">
                              <div className="lg:col-span-4">
                                <IngredientPicker label={`Line ${idx + 1}`} value={line.itemId} onChange={(id) => {
                                  const next = [...recvLines];
                                  next[idx] = { ...next[idx], itemId: id };
                                  setRecvLines(next);
                                }} items={pickerItems} />
                              </div>
                              <div className="lg:col-span-2">
                                <Field label={item ? `Qty (${item.unit})` : "Qty"}>
                                  <TextInput value={line.quantity} onChange={(e) => { const next = [...recvLines]; next[idx].quantity = e.target.value; setRecvLines(next); }} inputMode="decimal" />
                                </Field>
                              </div>
                              <div className="lg:col-span-2">
                                <Field label="Unit cost">
                                  <TextInput value={line.unitCost} onChange={(e) => { const next = [...recvLines]; next[idx].unitCost = e.target.value; setRecvLines(next); }} inputMode="decimal" />
                                </Field>
                              </div>
                              <div className="lg:col-span-2 text-right text-xs text-stone-500 lg:pb-2">
                                Line: <span className="font-semibold text-stone-800 dark:text-stone-200">{pkr(lineTotal)}</span>
                              </div>
                              <div className="lg:col-span-2">
                                {item?.trackExpiry ? (
                                  <DateInput label="Expiry" value={line.expiryDate} onChange={(v) => { const next = [...recvLines]; next[idx].expiryDate = v; setRecvLines(next); }} hint="Required" />
                                ) : (
                                  <Field label="Expiry"><TextInput disabled value="" placeholder="N/A" /></Field>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setRecvLines((p) => [...p, { itemId: "", quantity: "", unitCost: "", expiryDate: "" }])}>+ Add row</button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Tax"><TextInput value={recvTax} onChange={(e) => setRecvTax(e.target.value)} inputMode="decimal" /></Field>
                        <Field label="Discount"><TextInput value={recvDiscount} onChange={(e) => setRecvDiscount(e.target.value)} inputMode="decimal" /></Field>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-stone-400">Payment</p>
                        <Segment
                          value={recvPaymentMode}
                          onChange={setRecvPaymentMode}
                          options={[
                            { id: "full", label: "Paid in full" },
                            { id: "credit", label: "On credit" },
                            { id: "partial", label: "Partial" },
                          ]}
                        />
                        {recvPaymentMode === "partial" && (
                          <div className="mt-3 max-w-xs">
                            <Field label="Amount paid now">
                              <TextInput value={recvPartialPaid} onChange={(e) => setRecvPartialPaid(e.target.value)} inputMode="decimal" placeholder="0" />
                            </Field>
                          </div>
                        )}
                      </div>
                      <button type="submit" className="btn-primary w-full sm:w-auto">Receive stock</button>
                    </form>
                  </InventoryPanel>
                  <InventoryPanel title="Summary" description="Live totals for this receipt">
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between"><dt className="text-stone-500">Subtotal</dt><dd className="font-medium">{pkr(recvSubtotal)}</dd></div>
                      <div className="flex justify-between"><dt className="text-stone-500">Tax</dt><dd>{pkr(Number(recvTax) || 0)}</dd></div>
                      <div className="flex justify-between"><dt className="text-stone-500">Discount</dt><dd>-{pkr(Number(recvDiscount) || 0)}</dd></div>
                      <div className="flex justify-between border-t border-stone-200 pt-3 dark:border-stone-700">
                        <dt className="font-semibold">Total</dt>
                        <dd className="text-lg font-bold">{pkr(recvTotal)}</dd>
                      </div>
                      <div className="flex justify-between"><dt className="text-stone-500">Paying now</dt><dd className="font-medium text-brand-700">{pkr(recvPaidAmount)}</dd></div>
                      <div className="flex justify-between"><dt className="text-stone-500">Balance after</dt><dd className={recvTotal - recvPaidAmount > 0 ? "font-medium text-amber-700" : ""}>{pkr(Math.max(0, recvTotal - recvPaidAmount))}</dd></div>
                    </dl>
                  </InventoryPanel>
                </div>
              )}
              <DetailDrawer open={Boolean(selectedPurchase)} title="Purchase" onClose={() => setSelectedPurchase(null)}>
                {selectedPurchase && (
                  <dl className="space-y-3 text-sm">
                    <div><dt className="text-xs text-stone-500">Supplier</dt><dd className="font-semibold">{selectedPurchase.supplierName}</dd></div>
                    <div><dt className="text-xs text-stone-500">Invoice</dt><dd className="font-mono">{selectedPurchase.invoiceRef || "—"}</dd></div>
                    <div><dt className="text-xs text-stone-500">Date</dt><dd>{new Date(selectedPurchase.purchaseDate).toLocaleString()}</dd></div>
                    <div><dt className="text-xs text-stone-500">Lines</dt><dd>{selectedPurchase.lineCount}</dd></div>
                    <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                      <div className="flex justify-between"><span>Total</span><span className="font-bold">{pkr(selectedPurchase.total)}</span></div>
                      <div className="mt-1 flex justify-between text-stone-600"><span>Paid</span><span>{pkr(selectedPurchase.paidAmount)}</span></div>
                      <div className="mt-1 flex justify-between"><span>Due</span><span className="font-semibold text-amber-700">{pkr(Math.max(0, selectedPurchase.total - selectedPurchase.paidAmount))}</span></div>
                    </div>
                    <PaymentPill status={selectedPurchase.paymentStatus} />
                  </dl>
                )}
              </DetailDrawer>
            </div>
          )}

          {tab === "recipes" && (
            <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)]">
              <InventoryPanel title="Menu dishes" description="Select a dish to edit its bill of materials" className="min-w-0">
                <div className="flex min-h-0 flex-col gap-3">
                  <SearchField value={recipeMenuFilter} onChange={setRecipeMenuFilter} placeholder="Search menu…" />
                  <Segment
                    fullWidth
                    value={recipeFilterMode}
                    onChange={setRecipeFilterMode}
                    options={[
                      { id: "all", label: "All" },
                      { id: "missing", label: "No recipe" },
                      { id: "has", label: "Has recipe" },
                      { id: "review", label: "Needs review" },
                    ]}
                  />
                  <ul className="inventory-scroll max-h-[min(52vh,480px)] space-y-0.5 overflow-y-auto rounded-xl border border-stone-100 p-1 text-sm dark:border-stone-800">
                    {filteredMenuItems.map((m) => {
                      const fc = menuFoodCostMap[m.id];
                      const needsReview = !m.hasRecipe || (fc != null && fc < LOW_FOOD_COST_PCT);
                      return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setRecipeMenuId(m.id)}
                          className={`w-full rounded-lg px-2.5 py-2 text-left transition ${
                            recipeMenuId === m.id
                              ? "bg-brand-50 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-800"
                              : "hover:bg-stone-50 dark:hover:bg-stone-800"
                          }`}
                        >
                          <span className="flex items-start justify-between gap-2">
                            <span className="block font-medium leading-snug text-stone-900 dark:text-stone-100">{m.name}</span>
                            {m.hasRecipe && fc != null && (
                              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${fc > 40 ? "bg-red-100 text-red-800" : fc < LOW_FOOD_COST_PCT ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
                                {fc.toFixed(0)}% FC
                              </span>
                            )}
                          </span>
                          {!m.hasRecipe && <span className="mt-0.5 block text-xs text-amber-600">No recipe</span>}
                          {m.hasRecipe && needsReview && fc == null && recipeMenuId !== m.id && (
                            <span className="mt-0.5 block text-xs text-stone-400">Open to load cost</span>
                          )}
                        </button>
                      </li>
                    );})}
                    {filteredMenuItems.length === 0 && (
                      <li className="px-2 py-6 text-center text-xs text-stone-400">No dishes match your search.</li>
                    )}
                  </ul>
                </div>
              </InventoryPanel>
              <InventoryPanel
                title="Recipe editor"
                description={recipeMenuId ? "Per-portion ingredient quantities" : "Pick a menu dish on the left"}
                className="min-w-0"
              >
                {!recipeMenuId ? (
                  <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-stone-500 dark:border-stone-700">
                    Select a dish from the list to view or edit its recipe.
                  </p>
                ) : (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!recipeMenuId) return;
                      const lines = recipeLines
                        .filter((l) => l.itemId && Number(l.quantity) > 0)
                        .map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) }));
                      await saveRecipe(recipeMenuId, { lines, yieldPortions: Number(recipeYield) || 1 });
                      setMsg("Recipe saved.");
                    }}
                    className="space-y-4"
                  >
                    {recipeMeta.costWarning && (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                        {recipeMeta.costWarning}{" "}
                        <a className="font-semibold underline" href="/admin/reports/dish-costing">
                          Open dish costing
                        </a>
                      </p>
                    )}
                    <div className="grid gap-2 rounded-xl bg-stone-50 p-3 text-sm dark:bg-stone-800/50 sm:grid-cols-2 lg:grid-cols-4">
                      <div><p className="text-xs text-stone-500">Recipe cost</p><p className="font-bold">{pkr(recipeMeta.recipeCost)}</p></div>
                      <div><p className="text-xs text-stone-500">Menu price</p><p className="font-bold">{pkr(recipeMeta.price)}</p></div>
                      <div>
                        <p className="text-xs text-stone-500">Food cost %</p>
                        <p className={`font-bold ${recipeMeta.foodCostPercent > 40 ? "text-red-600" : recipeMeta.foodCostPercent > 30 ? "text-amber-600" : recipeMeta.foodCostPercent < LOW_FOOD_COST_PCT ? "text-amber-600" : "text-emerald-600"}`}>
                          {recipeMeta.foodCostPercent.toFixed(1)}%
                        </p>
                      </div>
                      <div><p className="text-xs text-stone-500">Margin</p><p className="font-bold">{recipeMeta.marginPercent.toFixed(1)}%</p></div>
                    </div>
                    <Field label="Yield (portions per batch)">
                      <TextInput className="max-w-[10rem]" value={recipeYield} onChange={(e) => setRecipeYield(e.target.value)} inputMode="numeric" />
                    </Field>
                    <div className="space-y-3">
                      {recipeLines.map((line, idx) => {
                        const ing = items.find((i) => i.id === line.itemId);
                        const unit = ing?.unit ?? recipeLineUnits[line.itemId] ?? "PIECE";
                        const lineCost = (Number(line.quantity) || 0) * (ing?.avgCost ?? 0);
                        const share = recipeMeta.recipeCost > 0 ? (lineCost / recipeMeta.recipeCost) * 100 : 0;
                        return (
                        <div key={idx} className="relative grid gap-2 rounded-xl border border-stone-100 p-3 dark:border-stone-800 sm:grid-cols-[1fr_1fr_auto]">
                          <IngredientPicker
                            label="Ingredient"
                            value={line.itemId}
                            onChange={(id) => {
                              const next = [...recipeLines];
                              next[idx].itemId = id;
                              setRecipeLines(next);
                            }}
                            items={pickerItems}
                          />
                          <Field label={`Qty / portion (${unit})`}>
                            <TextInput
                              value={line.quantity}
                              onChange={(e) => {
                                const next = [...recipeLines];
                                next[idx].quantity = e.target.value;
                                setRecipeLines(next);
                              }}
                              inputMode="decimal"
                            />
                          </Field>
                          <div className="flex flex-col items-end justify-between gap-1 sm:pt-6">
                            <button
                              type="button"
                              className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-red-600 dark:hover:bg-stone-800"
                              aria-label="Remove line"
                              onClick={() => setRecipeLines((p) => (p.length <= 1 ? [{ itemId: "", quantity: "" }] : p.filter((_, i) => i !== idx)))}
                            >
                              <X size={16} />
                            </button>
                            {line.itemId && recipeMeta.recipeCost > 0 && (
                              <p className="text-[10px] text-stone-500">{share.toFixed(0)}% · {pkr(lineCost)}</p>
                            )}
                          </div>
                        </div>
                      );})}
                    </div>
                    <div className="flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between dark:border-stone-800">
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-brand-600 hover:text-brand-700"
                        onClick={() => setRecipeLines((p) => [...p, { itemId: "", quantity: "" }])}
                      >
                        + Ingredient line
                      </button>
                      <button type="submit" className="btn-primary w-full shrink-0 sm:w-auto">
                        Save recipe
                      </button>
                    </div>
                  </form>
                )}
              </InventoryPanel>
            </div>
          )}

          {tab === "waste" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
              <InventoryPanel title="Log waste" description="Reduces on-hand stock and records cost impact">
                <form onSubmit={async (e) => { e.preventDefault(); await logWaste({ itemId: wasteItem, quantity: Number(wasteQty), reason: wasteReason, notes: wasteNote.trim() || undefined }); setMsg("Waste logged."); setWasteNote(""); void fetchWaste().then(setWasteData); await load(); }} className="grid gap-3 sm:grid-cols-2">
                  <IngredientPicker label="Ingredient" value={wasteItem} onChange={setWasteItem} items={pickerItems} />
                  <Field label="Quantity" required hint={wasteItem ? `Unit: ${items.find((i) => i.id === wasteItem)?.unit ?? "—"}` : undefined}>
                    <TextInput value={wasteQty} onChange={(e) => setWasteQty(e.target.value)} inputMode="decimal" required />
                  </Field>
                  <SelectField label="Reason" value={wasteReason} onChange={setWasteReason} options={WASTE_REASONS.map((r) => ({ value: r.value, label: r.label }))} className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <Field label="Notes (optional)"><TextInput value={wasteNote} onChange={(e) => setWasteNote(e.target.value)} placeholder="Batch, station, etc." /></Field>
                  </div>
                  <button type="submit" className="btn-primary sm:col-span-2 sm:w-fit">Record waste</button>
                </form>
                <InventoryTable columns={["When", "Item", "Qty", "Reason", "Cost"]} loading={!wasteData}>
                  {(wasteData?.logs ?? []).map((l) => (
                    <tr key={l.loggedAt + l.itemName}>
                      <td className="px-4 py-2 text-xs">{new Date(l.loggedAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{l.itemName}</td>
                      <td className="px-4 py-2 font-mono">{l.quantity}</td>
                      <td className="px-4 py-2 text-xs">{wasteReasonLabel(l.reason)}</td>
                      <td className="px-4 py-2">{pkr(l.costAtTime)}</td>
                    </tr>
                  ))}
                  {wasteData && wasteData.logs.length === 0 && (
                    <EmptyRow colSpan={5}>
                      <InventoryEmptyState title="No waste entries" description="Logged waste appears here with cost impact." />
                    </EmptyRow>
                  )}
                </InventoryTable>
              </InventoryPanel>
              <InventoryPanel title="Waste summary">
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl bg-stone-50 p-2 dark:bg-stone-800/50"><p className="text-xs text-stone-500">Today</p><p className="font-bold">{pkr(wasteData?.totals.today ?? 0)}</p></div>
                  <div className="rounded-xl bg-stone-50 p-2 dark:bg-stone-800/50"><p className="text-xs text-stone-500">Week</p><p className="font-bold">{pkr(wasteData?.totals.week ?? 0)}</p></div>
                  <div className="rounded-xl bg-stone-50 p-2 dark:bg-stone-800/50"><p className="text-xs text-stone-500">Month</p><p className="font-bold">{pkr(wasteData?.totals.month ?? 0)}</p></div>
                </div>
                {wasteMonthPct != null && (
                  <p className="mt-2 text-center text-xs text-stone-500">
                    Month waste ≈ <strong className="text-stone-700 dark:text-stone-300">{wasteMonthPct.toFixed(1)}%</strong> of current stock value
                  </p>
                )}
                {wasteChart.length > 0 ? (
                  <div className="mt-4 h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={wasteChart} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                          {wasteChart.map((_, i) => (<Cell key={i} fill={["#ea580c", "#f97316", "#fb923c", "#fdba74", "#fed7aa"][i % 5]} />))}
                        </Pie>
                        <Tooltip formatter={(v: number) => pkr(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <AdminEmptyState
                    compact
                    className="mt-4"
                    icon={Trash2}
                    title="No waste logged yet"
                    description="Reason breakdown appears after you record waste."
                  />
                )}
              </InventoryPanel>
            </div>
          )}

          {tab === "suppliers" && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard label="Suppliers" value={suppliers.length} />
                <MetricCard label="Total payable" value={pkr(totalSupplierPayable)} accent={totalSupplierPayable > 0 ? "amber" : undefined} />
              </div>
              <InventoryPanel title="Suppliers" description="Tap a row for ledger and payments" action={<button type="button" className="btn-primary text-xs" onClick={() => setSupplierModal(true)}>+ New supplier</button>}>
                <InventoryTable columns={["Name", "Phone", "Balance due", ""]}>
                  {suppliers.map((s) => {
                    const bal = supplierBalances[s.id];
                    const phone = s.phone?.replace(/\D/g, "");
                    return (
                      <tr
                        key={s.id}
                        className="cursor-pointer hover:bg-stone-50 dark:hover:bg-stone-800/40"
                        onClick={() => setSupplierDetailId(s.id)}
                      >
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3 text-stone-500">
                          {s.phone ? (
                            <a href={`tel:${s.phone}`} className="hover:text-brand-600" onClick={(e) => e.stopPropagation()}>{s.phone}</a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {bal == null ? <span className="text-xs text-stone-400">…</span> : bal > 0 ? <span className="font-medium text-amber-700">{pkr(bal)}</span> : <span className="text-stone-400">—</span>}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {phone && (
                            <a
                              href={`https://wa.me/${phone.startsWith("92") ? phone : `92${phone.replace(/^0/, "")}`}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"
                            >
                              <MessageCircle size={14} /> WhatsApp
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {suppliers.length === 0 && <EmptyRow colSpan={4}>Add a supplier to link purchases.</EmptyRow>}
                </InventoryTable>
              </InventoryPanel>
              <DetailDrawer
                open={Boolean(supplierDetailId)}
                title={suppliers.find((s) => s.id === supplierDetailId)?.name ?? "Supplier"}
                onClose={() => { setSupplierDetailId(null); setSupplierPayAmount(""); }}
              >
                {supplierLedger && supplierDetailId && (
                  <div className="space-y-4 text-sm">
                    <div className="rounded-xl bg-stone-50 p-3 dark:bg-stone-800/50">
                      <p className="text-xs text-stone-500">Balance due</p>
                      <p className="text-2xl font-bold text-amber-700">{pkr(supplierLedger.balanceDue)}</p>
                    </div>
                    <form
                      className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-stone-700"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const amount = Number(supplierPayAmount);
                        if (!amount) return;
                        await recordSupplierPayment(supplierDetailId, { amount, method: supplierPayMethod });
                        setSupplierPayAmount("");
                        setMsg("Payment recorded.");
                        const led = await fetchSupplierLedger(supplierDetailId);
                        setSupplierLedger(led);
                        setSupplierBalances((prev) => ({ ...prev, [supplierDetailId]: led.balanceDue }));
                      }}
                    >
                      <p className="text-xs font-bold uppercase text-stone-400">Record payment</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Field label="Amount"><TextInput value={supplierPayAmount} onChange={(e) => setSupplierPayAmount(e.target.value)} inputMode="decimal" required /></Field>
                        <SelectField label="Method" value={supplierPayMethod} onChange={setSupplierPayMethod} options={["CASH", "BANK", "CARD", "OTHER"].map((m) => ({ value: m, label: m }))} />
                      </div>
                      <button type="submit" className="btn-primary w-full text-sm">Save payment</button>
                    </form>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase text-stone-400">Recent purchases</p>
                      <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                        {supplierLedger.purchases.slice(0, 8).map((p) => (
                          <li key={p.id} className="flex justify-between rounded-lg bg-stone-50 px-2 py-1.5 dark:bg-stone-800/40">
                            <span>{new Date(p.purchaseDate).toLocaleDateString()} {p.invoiceRef ? `· ${p.invoiceRef}` : ""}</span>
                            <span>{pkr(p.total)} <PaymentPill status={p.paymentStatus} /></span>
                          </li>
                        ))}
                        {supplierLedger.purchases.length === 0 && <p className="text-stone-400">No purchases yet.</p>}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-bold uppercase text-stone-400">Payments</p>
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                        {supplierLedger.payments.slice(0, 6).map((p) => (
                          <li key={p.id} className="flex justify-between rounded-lg bg-stone-50 px-2 py-1.5 dark:bg-stone-800/40">
                            <span>{new Date(p.paidAt).toLocaleDateString()} · {p.method}</span>
                            <span className="font-medium">{pkr(p.amount)}</span>
                          </li>
                        ))}
                        {supplierLedger.payments.length === 0 && <p className="text-stone-400">No payments logged.</p>}
                      </ul>
                    </div>
                  </div>
                )}
                {!supplierLedger && supplierDetailId && <p className="text-sm text-stone-500">Loading ledger…</p>}
              </DetailDrawer>
            </>
          )}

          {tab === "movements" && (
            <InventoryPanel
              title="Stock ledger"
              description="Append-only audit trail for this branch"
              action={
                <a className="text-xs font-bold text-brand-600" href={movementExportHref} target="_blank" rel="noreferrer">
                  Export CSV
                </a>
              }
            >
              <div className="mb-3 flex flex-wrap gap-2">
                {(["", "today", "7d", "30d"] as const).map((p) => (
                  <button
                    key={p || "all"}
                    type="button"
                    onClick={() => applyMovementDatePreset(p)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${movementDatePreset === p ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-600 dark:bg-stone-800"}`}
                  >
                    {p === "" ? "All dates" : p === "today" ? "Today" : p === "7d" ? "7 days" : "30 days"}
                  </button>
                ))}
              </div>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SelectField label="Movement type" value={movementType} onChange={setMovementType} options={[{ value: "", label: "All types" }, ...["PURCHASE", "SALE_DEDUCTION", "WASTE", "ADJUSTMENT", "COUNT_CORRECTION", "TRANSFER_IN", "TRANSFER_OUT", "REVERSAL"].map((t) => ({ value: t, label: t }))]} />
                <SearchableSelect label="Ingredient" value={movementItem} onChange={setMovementItem} options={[{ id: "", name: "All items" }, ...pickerItems]} placeholder="All items…" />
                <DateInput label="From" value={movementFrom} onChange={(v) => { setMovementFrom(v); setMovementDatePreset(""); }} />
                <DateInput label="To" value={movementTo} onChange={(v) => { setMovementTo(v); setMovementDatePreset(""); }} />
              </div>
              <InventoryTable columns={["When", "Item", "Type", "Change", "Balance", "Reference", "Rs impact", "Reason"]}>
                {ledger.map((m) => {
                  const impact = m.unitCost != null ? m.quantityDelta * m.unitCost : null;
                  return (
                  <tr key={m.id} className="hover:bg-stone-50 dark:hover:bg-stone-800/40">
                    <td className="px-4 py-2 whitespace-nowrap text-xs">{new Date(m.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-2">{m.itemName}</td>
                    <td className="px-4 py-2"><MovementTypePill type={m.type} /></td>
                    <td className={`px-4 py-2 font-mono text-xs tabular-nums ${m.quantityDelta >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {m.quantityDelta > 0 ? "+" : ""}
                      {m.unit ? formatQty(m.quantityDelta, m.unit) : m.quantityDelta}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs tabular-nums">{m.unit ? formatQty(m.quantityAfter, m.unit) : m.quantityAfter}</td>
                    <td className="max-w-[7rem] px-4 py-2 text-xs text-stone-500">
                      {m.reference ? <span className="block truncate" title={m.reference}>{m.reference}</span> : "—"}
                    </td>
                    <td className="px-4 py-2 text-xs tabular-nums">{impact != null ? pkr(impact) : "—"}</td>
                    <td className="max-w-[8rem] px-4 py-2">
                      {m.reason ? (
                        <span className="block truncate text-xs text-stone-500" title={m.reason}>{m.reason}</span>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </td>
                  </tr>
                );})}
                {ledger.length === 0 && <EmptyRow colSpan={8}>No movements for these filters.</EmptyRow>}
              </InventoryTable>
            </InventoryPanel>
          )}

          {tab === "counts" && (
            <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
              <InventoryPanel title="Count sessions">
                <button type="button" className="btn-primary mb-3 w-full text-sm" onClick={async () => { const res = await startStockCount(); setMsg("Count started."); setActiveCountId(res.count.id); void fetchCounts().then((d) => setCounts(d.counts)); }}>Start new count</button>
                <ul className="space-y-1 text-sm">
                  {counts.map((c) => (
                    <li key={c.id} className="flex items-center gap-2">
                      <button type="button" onClick={() => setActiveCountId(c.id)} className={`flex-1 rounded-lg px-2 py-2 text-left ${activeCountId === c.id ? "bg-brand-50 dark:bg-brand-950/40" : "hover:bg-stone-50"}`}>
                        <p className="text-xs text-stone-500">{formatInventoryWhen(c.createdAt)}</p>
                        <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${countStatusClass(c.status)}`}>{c.status}</span>
                      </button>
                      {c.status === "DRAFT" && (
                        <button
                          type="button"
                          className="ml-2 text-xs font-semibold text-red-600"
                          onClick={async () => {
                            await deleteCount(c.id);
                            if (activeCountId === c.id) setActiveCountId("");
                            void fetchCounts().then((d) => setCounts(d.counts));
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </InventoryPanel>
              <InventoryPanel title="Count sheet" description="Enter physical quantities; hide system qty to reduce bias" action={
                <div className="flex flex-wrap items-center gap-3">
                  {countDetail.length > 0 && (
                    <p className="text-xs text-stone-500">
                      Est. variance value:{" "}
                      <strong className={countVarianceValue !== 0 ? "text-amber-700" : ""}>{pkr(countVarianceValue)}</strong>
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={showSystemOnCount} onChange={(e) => setShowSystemOnCount(e.target.checked)} /> Show system qty</label>
                </div>
              }>
                {activeCountId && countDetail.length > 0 ? (
                  <>
                    <InventoryTable columns={showSystemOnCount ? ["Item", "System", "Counted", "Variance", "Rs"] : ["Item", "Counted"]}>
                      {countDetail.map((line) => {
                        const counted = Number(line.countedQty) || 0;
                        const variance = counted - line.systemQty;
                        const ing = items.find((i) => i.id === line.itemId);
                        const varRs = line.countedQty ? variance * (ing?.avgCost ?? 0) : 0;
                        return (
                          <tr key={line.itemId}>
                            <td className="px-4 py-2">{line.itemName} <span className="text-xs text-stone-400">({line.unit})</span></td>
                            {showSystemOnCount && <td className="px-4 py-2 font-mono text-xs">{formatQty(line.systemQty, line.unit as InventoryUnit)}</td>}
                            <td className="px-4 py-2"><TextInput value={line.countedQty} onChange={(e) => setCountDetail((prev) => prev.map((l) => l.itemId === line.itemId ? { ...l, countedQty: e.target.value } : l))} inputMode="decimal" className="max-w-[120px]" /></td>
                            {showSystemOnCount && (
                              <>
                                <td className={`px-4 py-2 font-mono text-xs ${variance !== 0 ? "text-amber-600" : ""}`}>{line.countedQty ? formatQty(variance, line.unit as InventoryUnit) : "—"}</td>
                                <td className="px-4 py-2 text-xs">{line.countedQty ? pkr(varRs) : "—"}</td>
                              </>
                            )}
                          </tr>
                        );
                      })}
                    </InventoryTable>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" onClick={async () => { await patchCountLines(activeCountId, countDetail.filter((l) => l.countedQty).map((l) => ({ itemId: l.itemId, countedQty: Number(l.countedQty) }))); setMsg("Draft saved."); }}>Save draft</button>
                      <button type="button" className="btn-primary" onClick={async () => { await patchCountLines(activeCountId, countDetail.filter((l) => l.countedQty).map((l) => ({ itemId: l.itemId, countedQty: Number(l.countedQty) }))); await submitCount(activeCountId); setMsg("Submitted for approval."); void fetchCounts().then((d) => setCounts(d.counts)); }}>Submit count</button>
                      <button type="button" className="btn-primary" onClick={async () => { await approveCount(activeCountId); setMsg("Approved."); await load(); void fetchCounts().then((d) => setCounts(d.counts)); }}>Approve (manager)</button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-stone-500">Select or start a count session.</p>
                )}
              </InventoryPanel>
            </div>
          )}

          {tab === "transfers" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {transferDestinations.length === 0 ? (
                <InventoryPanel title="Transfers" className="lg:col-span-2">
                  <InventoryEmptyState
                    title="No other branches"
                    description="Add another branch to move stock between locations."
                  />
                </InventoryPanel>
              ) : (
                <InventoryPanel title="New transfer" description={`From: ${activeBranch?.name ?? "this branch"}`}>
                  <form onSubmit={async (e) => { e.preventDefault(); const lines = transferLines.filter((l) => l.itemId && Number(l.quantity) > 0).map((l) => ({ itemId: l.itemId, quantity: Number(l.quantity) })); await createTransfer({ toBranchId: transferTo, lines }); setMsg("Transfer created."); setTransferLines([{ itemId: "", quantity: "" }]); void fetchTransfers().then((d) => setTransfers(d.transfers)); }} className="space-y-3">
                    <SelectField label="To branch" value={transferTo} onChange={setTransferTo} options={transferDestinations.map((b) => ({ value: b.id, label: b.name }))} />
                    {transferLines.map((line, idx) => {
                      const ing = items.find((i) => i.id === line.itemId);
                      return (
                        <div key={idx} className="grid gap-2 sm:grid-cols-2">
                          <IngredientPicker label="Item" value={line.itemId} onChange={(id) => { const n = [...transferLines]; n[idx].itemId = id; setTransferLines(n); }} items={pickerItems} />
                          <Field label={ing ? `Qty (${ing.unit})` : "Quantity"}>
                            <TextInput value={line.quantity} onChange={(e) => { const n = [...transferLines]; n[idx].quantity = e.target.value; setTransferLines(n); }} inputMode="decimal" />
                          </Field>
                        </div>
                      );
                    })}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 dark:border-stone-800">
                      <button type="button" className="text-sm font-semibold text-brand-600" onClick={() => setTransferLines((p) => [...p, { itemId: "", quantity: "" }])}>+ Line</button>
                      <button type="submit" className="btn-primary">Create transfer</button>
                    </div>
                  </form>
                </InventoryPanel>
              )}
              <InventoryPanel
                title="Transfers"
                action={
                  <Segment
                    value={transferStatusFilter}
                    onChange={setTransferStatusFilter}
                    options={[
                      { id: "all", label: "All" },
                      { id: "PENDING", label: "Pending" },
                      { id: "IN_TRANSIT", label: "In transit" },
                      { id: "RECEIVED", label: "Received" },
                    ]}
                  />
                }
              >
                <ul className="space-y-2 text-sm">
                  {filteredTransfers.map((t) => (
                    <li key={t.id} className="rounded-xl border border-stone-100 p-3 dark:border-stone-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${countStatusClass(t.status)}`}>{t.status.replace(/_/g, " ")}</span>
                        <span className="text-xs text-stone-500">{new Date(t.createdAt).toLocaleString()}</span>
                      </div>
                      {t.lines && <p className="mt-1 text-xs text-stone-500">{t.lines.length} line(s)</p>}
                      <div className="mt-2 flex gap-2">
                        {t.status === "PENDING" && selection === t.fromBranchId && (
                          <button type="button" className="btn-secondary text-xs" onClick={async () => { await shipTransfer(t.id); void fetchTransfers().then((d) => setTransfers(d.transfers)); await load(); }}>Ship</button>
                        )}
                        {t.status === "IN_TRANSIT" && selection === t.toBranchId && (
                          <button type="button" className="btn-primary text-xs" onClick={async () => { await receiveTransfer(t.id); void fetchTransfers().then((d) => setTransfers(d.transfers)); await load(); }}>Receive at branch</button>
                        )}
                      </div>
                    </li>
                  ))}
                  {filteredTransfers.length === 0 && <p className="text-stone-500">No transfers match this filter.</p>}
                </ul>
              </InventoryPanel>
            </div>
          )}

          {tab === "reports" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <InventoryPanel title="Valuation by category">
                {valuationChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={valuationChart}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => pkr(v)} />
                      <Bar dataKey="value" fill="#ea580c" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-stone-500">No stock value data.</p>
                )}
              </InventoryPanel>
              <InventoryPanel title="Top stock by value">
                <ul className="space-y-1 text-sm">
                  {topStockByValue.map((i, n) => (
                    <li key={i.id} className="flex justify-between gap-2 rounded-lg px-2 py-1.5 odd:bg-stone-50 dark:odd:bg-stone-800/40">
                      <span><span className="text-stone-400">{n + 1}.</span> {i.name}</span>
                      <span className="font-medium">{pkr(i.stockValue)}</span>
                    </li>
                  ))}
                  {topStockByValue.length === 0 && <p className="text-stone-500">No stock on hand.</p>}
                </ul>
              </InventoryPanel>
              <InventoryPanel title="Slow / excess (by low value)" className="lg:col-span-2">
                <p className="mb-2 text-xs text-stone-500">In-stock items with the lowest inventory value — review for dead stock.</p>
                <div className="flex flex-wrap gap-2">
                  {deadStockItems.map((i) => (
                    <span key={i.id} className="rounded-full bg-stone-100 px-3 py-1 text-xs dark:bg-stone-800">
                      {i.name} · {formatQty(i.quantity, i.unit)} · {pkr(i.stockValue)}
                    </span>
                  ))}
                  {deadStockItems.length === 0 && <p className="text-sm text-stone-500">Nothing to flag.</p>}
                </div>
              </InventoryPanel>
              {groupedReorder.map(([supplierName, lines]) => (
                <InventoryPanel
                  key={supplierName}
                  title={`Reorder — ${supplierName}`}
                  className="lg:col-span-2"
                  action={
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary text-xs" onClick={() => copyReorderList(lines)}>
                        <Copy size={14} className="mr-1 inline" /> Copy
                      </button>
                      <button type="button" className="btn-secondary text-xs" onClick={() => whatsappReorderList(lines, supplierName)}>
                        <MessageCircle size={14} className="mr-1 inline" /> WhatsApp
                      </button>
                    </div>
                  }
                >
                  <ul className="space-y-2 text-sm">
                    {lines.map((s) => (
                      <li key={s.itemId} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 dark:bg-stone-800/40">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-stone-500">{formatQty(s.suggestedQty, s.unit ?? "PIECE")} · est. {pkr(s.estimatedCost ?? 0)}</p>
                        </div>
                        <button type="button" className="btn-secondary text-xs" onClick={() => { setTab("receive"); setReceiveView("new"); }}>
                          Receive
                        </button>
                      </li>
                    ))}
                  </ul>
                </InventoryPanel>
              ))}
              {suggestions.length === 0 && (
                <InventoryPanel title="Reorder suggestions" className="lg:col-span-2">
                  <p className="text-stone-500">All items above reorder level.</p>
                </InventoryPanel>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={Boolean(adjustItem)} title={adjustItem ? `Adjust — ${adjustItem.name}` : ""} onClose={() => setAdjustItem(null)}>
        {adjustItem && (
          <form onSubmit={onAdjustSubmit} className="space-y-3">
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-800/50">On hand: <strong className="font-mono">{adjustItem.quantity}</strong> {adjustItem.unit}</p>
            <Segment value={adjustMode} onChange={setAdjustMode} options={[{ id: "add", label: "Add" }, { id: "remove", label: "Remove" }, { id: "set", label: "Set exact" }]} />
            <Field label="Quantity" required><TextInput value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} inputMode="decimal" required /></Field>
            <SelectField label="Reason" value={adjustReason} onChange={setAdjustReason} options={["Count correction", "Damage", "Wastage", "Staff meal", "Other"].map((r) => ({ value: r, label: r }))} />
            <p className="text-sm">Preview balance: <strong className="font-mono text-brand-700">{previewBalance}</strong> {adjustItem.unit}</p>
            <div className="flex gap-2 pt-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setAdjustItem(null)}>Cancel</button>
              <button type="submit" className="btn-primary flex-1" disabled={adjustBusy}>{adjustBusy ? "Saving…" : "Save adjustment"}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={supplierModal} title="New supplier" onClose={() => setSupplierModal(false)}>
        <form onSubmit={async (e) => { e.preventDefault(); await createSupplier({ name: supName, phone: supPhone, email: supEmail, address: supAddress, paymentTerms: supTerms }); setSupplierModal(false); setSupName(""); const sup = await fetchSuppliers(); setSuppliers(sup.suppliers); setMsg("Supplier added."); }} className="space-y-3">
          <Field label="Name" required><TextInput value={supName} onChange={(e) => setSupName(e.target.value)} required /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Phone"><TextInput value={supPhone} onChange={(e) => setSupPhone(e.target.value)} /></Field>
            <Field label="Email"><TextInput type="email" value={supEmail} onChange={(e) => setSupEmail(e.target.value)} /></Field>
          </div>
          <Field label="Address"><TextInput value={supAddress} onChange={(e) => setSupAddress(e.target.value)} /></Field>
          <Field label="Payment terms"><TextInput value={supTerms} onChange={(e) => setSupTerms(e.target.value)} placeholder="Net 30, COD…" /></Field>
          <button type="submit" className="btn-primary w-full">Save supplier</button>
        </form>
      </Modal>

      <ConfirmSheet
        open={Boolean(archiveTarget)}
        title="Archive ingredient?"
        message={`${archiveTarget?.name ?? "This item"} will be hidden from active lists. Stock history is kept.`}
        confirmLabel="Archive"
        danger
        saving={false}
        onClose={() => setArchiveTarget(null)}
        onConfirm={async () => {
          if (!archiveTarget) return;
          await patchInventoryItem(archiveTarget.id, { isActive: false });
          setArchiveTarget(null);
          setMsg("Item archived.");
          await load();
        }}
      />
      <InputSheet
        open={categorySheetOpen}
        title="New category"
        label="Category name"
        placeholder="e.g. Dry goods"
        saving={categorySaving}
        onClose={() => !categorySaving && setCategorySheetOpen(false)}
        onConfirm={async (name) => {
          setCategorySaving(true);
          try {
            await createCategory(name);
            const cats = await fetchCategories();
            setCategories(cats.categories);
            setCategorySheetOpen(false);
          } finally {
            setCategorySaving(false);
          }
        }}
      />
    </AdminPage>
  );
}
