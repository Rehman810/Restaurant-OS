"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Bike,
  ChevronRight,
  LogOut,
  Maximize2,
  Minimize2,
  Search,
  ShoppingBag,
  UtensilsCrossed,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { fetchAllDeals, fetchAllMenuItems } from "@/lib/catalog-api";
import { useAuth } from "@/lib/auth";
import { DEFAULT_STORE_NAME, storeDisplayName } from "@/lib/branding";
import { buildPosOrderPayload, type PosLine, usePosCart } from "@/lib/pos-cart";
import { computePosTotalsClient } from "@/lib/pos-totals";
import { buildPaymentsPayload, posChargeBlockedReason, type PosPaymentRow } from "@/lib/pos/checkout-helpers";
import {
  isWalkInCustomerName,
  POS_WALK_IN_LABEL,
  resolvePosCustomerNameForCheckout,
} from "@/lib/pos/delivery-customer";
import { readPosFullscreen, writePosFullscreen } from "@/lib/pos/display";
import { buildQuickAddConfig, itemHasConfigurableOptions } from "@/lib/menu-price";
import { printReceipt } from "@/lib/print-receipt";
import { pkr } from "@/lib/format";
import { Deal, DeliveryArea, FulfillmentType, MenuItem, Order, PaymentMethod } from "@/lib/types";
import { PosItemSheet } from "@/components/admin/PosItemSheet";
import { ManagerApprovalModal } from "@/components/admin/ManagerApprovalModal";
import { InputSheet } from "@/components/admin/InputSheet";
import { PosCartPanel } from "@/components/admin/pos/PosCartPanel";
import { PosItemActionSheet } from "@/components/admin/pos/PosItemActionSheet";
import { PosLineSheet } from "@/components/admin/pos/PosLineSheet";
import { PosMenuBrowser } from "@/components/admin/pos/PosMenuBrowser";
import { PosConnectivityBanner } from "@/components/admin/pos/PosConnectivityBanner";
import { PosHelpButton } from "@/components/admin/pos/PosHelpButton";
import { PosCustomerSheet } from "@/components/admin/pos/PosCustomerSheet";
import { PosOfflineBar } from "@/components/admin/pos/PosOfflineBar";
import { setMenuItemStock } from "@/lib/admin-kitchen";
import {
  readPinnedMenuIds,
  readPosMenuDensity,
  togglePinnedMenuId,
  writePosMenuDensity,
  type PosMenuDensity,
} from "@/lib/pos/menu-preferences";
import { useStore } from "@/lib/store";
import { getDeviceLabel } from "@/lib/offline/device-label";
import {
  enqueuePosOrder,
  isIndexedDbAvailable,
  nextOfflineLabel,
  saveDealsSnapshot,
  saveMenuSnapshot,
} from "@/lib/offline/pos-db";
import { buildOfflinePrintOrder } from "@/lib/offline/offline-receipt";
import { syncPosQueue } from "@/lib/offline/pos-sync";
import { onPosOrderSynced } from "@/lib/offline/pos-sync-events";
import { auditOfflineLogoutOverride, hasPendingOfflineQueue } from "@/lib/offline/logout-guard";
import { pendingQueueCount } from "@/lib/offline/pos-db";
import { ConfirmSheet } from "@/components/admin/ConfirmSheet";
import { fetchFloor, openTableSession, seatReservation, type FloorTable } from "@/modules/dine-in/api";
import { useBranch } from "@/modules/branches/BranchContext";

type PosMode = FulfillmentType;
type MobileView = "menu" | "cart";

const MODES: { id: PosMode; label: string; short: string; icon: typeof UtensilsCrossed }[] = [
  { id: "DINE_IN", label: "Dine-in", short: "Dine", icon: UtensilsCrossed },
  { id: "PICKUP", label: "Takeaway", short: "Take", icon: ShoppingBag },
  { id: "DELIVERY", label: "Delivery", short: "Deliv", icon: Bike },
];

export default function PosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selection } = useBranch();
  const { user, logout } = useAuth();
  const isManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canMark86 =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "CASHIER" ||
    user?.role === "CHEF";
  const branchKey = selection === "all" ? "all" : String(selection);
  const lines = usePosCart((s) => s.lines);
  const addItem = usePosCart((s) => s.addItem);
  const addDeal = usePosCart((s) => s.addDeal);
  const setQty = usePosCart((s) => s.setQty);
  const remove = usePosCart((s) => s.remove);
  const setLinePrice = usePosCart((s) => s.setLinePrice);
  const setLineInstructions = usePosCart((s) => s.setLineInstructions);
  const clear = usePosCart((s) => s.clear);
  const publicStore = useStore();

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<PosMode>("DINE_IN");
  const [customerName, setCustomerName] = useState(POS_WALK_IN_LABEL);
  const [customerPhone, setCustomerPhone] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [floorTables, setFloorTables] = useState<FloorTable[]>([]);
  const [tableSessionId, setTableSessionId] = useState("");
  const [diningTableId, setDiningTableId] = useState("");
  const [waiterId, setWaiterId] = useState("");
  const [floorWaiters, setFloorWaiters] = useState<{ id: string; name: string }[]>([]);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [walkInForce, setWalkInForce] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [areaId, setAreaId] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [configItem, setConfigItem] = useState<MenuItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [store, setStore] = useState({ name: DEFAULT_STORE_NAME, phone: "", address: "" });
  const [freeDeliveryAbove, setFreeDeliveryAbove] = useState<number | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [mobileView, setMobileView] = useState<MobileView>("menu");
  const [splitRows, setSplitRows] = useState<PosPaymentRow[]>([]);
  const [lineSheet, setLineSheet] = useState<PosLine | null>(null);
  const [holdCount, setHoldCount] = useState(0);
  const [holdsOpen, setHoldsOpen] = useState(false);
  const [holds, setHolds] = useState<{ id: string; label: string | null; payload: unknown; createdAt: string }[]>([]);
  const [clearUndoUntil, setClearUndoUntil] = useState(0);
  const [clearedSnapshot, setClearedSnapshot] = useState<PosLine[] | null>(null);
  const [posFullscreen, setPosFullscreen] = useState(false);
  const [successToast, setSuccessToast] = useState<{ orderNumber: string; change?: number } | null>(null);
  const [priceOverridePending, setPriceOverridePending] = useState<{ id: string; price: number } | null>(null);
  const [menuDensity, setMenuDensity] = useState<PosMenuDensity>(() => readPosMenuDensity());
  const [popularIds, setPopularIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedMenuIds(branchKey));
  const [actionItem, setActionItem] = useState<MenuItem | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountReasonCode, setDiscountReasonCode] = useState("");
  const [discountReasonNote, setDiscountReasonNote] = useState("");
  const [maxCashierDiscountPercent, setMaxCashierDiscountPercent] = useState(10);
  const [discountReasons, setDiscountReasons] = useState<string[]>([]);
  const [voidReasons, setVoidReasons] = useState<string[]>([]);
  const [approvalFlow, setApprovalFlow] = useState<"checkout" | "void" | "price" | null>(null);
  const [voidReasonCode, setVoidReasonCode] = useState("");
  const [voidReasonNote, setVoidReasonNote] = useState("");
  const [priceEditLine, setPriceEditLine] = useState<{ id: string; price: number } | null>(null);
  const [shiftOpen, setShiftOpen] = useState(true);
  const [cashTendered, setCashTendered] = useState("");
  const [checkoutIdempotencyKey, setCheckoutIdempotencyKey] = useState(() => crypto.randomUUID());
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [conflictCount, setConflictCount] = useState(0);
  const [offlinePosEnabled, setOfflinePosEnabled] = useState(true);
  const [logoutQueueWarn, setLogoutQueueWarn] = useState(false);
  const idbOk = isIndexedDbAvailable();
  const offlineMode = !isOnline && idbOk && offlinePosEnabled;

  const loadFloor = useCallback(async () => {
    if (selection === "all") return;
    try {
      const data = await fetchFloor();
      setFloorTables(data.tables);
      setFloorWaiters(data.waiters);
      const sessionParam = searchParams.get("session");
      const tableParam = searchParams.get("table");
      if (sessionParam && tableParam) {
        setTableSessionId(sessionParam);
        setDiningTableId(tableParam);
        const t = data.tables.find((x) => x.id === tableParam);
        if (t) setTableNumber(t.label);
      }
    } catch {
      /* branch may be unset */
    }
  }, [selection, searchParams]);

  useEffect(() => {
    if (mode === "DINE_IN") void loadFloor();
  }, [mode, loadFloor]);

  const load = useCallback(async () => {
    const { loadMenuSnapshot, loadDealsSnapshot } = await import("@/lib/offline/pos-db");
    let m: MenuItem[];
    let d: Deal[];
    try {
      [m, d] = await Promise.all([fetchAllMenuItems(), fetchAllDeals()]);
    } catch {
      m = (await loadMenuSnapshot()) ?? [];
      d = (await loadDealsSnapshot()) ?? [];
      if (!m.length) throw new Error("offline");
    }
    const [a, s] = await Promise.all([
      api<DeliveryArea[]>("/delivery-areas").catch(() => [] as DeliveryArea[]),
      api<{ settings: { storeName?: string; phone: string; address: string; freeDeliveryAbove?: string | number | null } }>(
        "/settings/public"
      ).catch(() => null),
    ]);
    setMenu(m);
    setDeals(d.filter((x) => x.isActive));
    void saveMenuSnapshot(m);
    void saveDealsSnapshot(d);
    setAreas(a.filter((x) => x.isDelivering));
    if (a[0]) setAreaId(a[0].id);
    if (s?.settings) {
      setStore({
        name: storeDisplayName(s.settings),
        phone: s.settings.phone,
        address: s.settings.address,
      });
      setFreeDeliveryAbove(
        s.settings.freeDeliveryAbove != null ? Number(s.settings.freeDeliveryAbove) : null
      );
    }
  }, []);

  useEffect(() => {
    const unsub = onPosOrderSynced(({ order }) => {
      printReceipt(order, store, { cashier: user?.name });
      setLastOrder(order);
    });
    return () => {
      unsub();
    };
  }, [store, user?.name]);

  async function guardedLogout() {
    if (await hasPendingOfflineQueue()) {
      if (!isManager) {
        setError("Sync or clear the offline queue before signing out.");
        return;
      }
      setLogoutQueueWarn(true);
      return;
    }
    logout();
    router.replace("/login");
  }

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    let pending = 0;
    const refresh = () => {
      void pendingQueueCount().then((n) => {
        pending = n;
      });
    };
    refresh();
    const id = window.setInterval(refresh, 5000);
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!isManager) return;
    void api<{ orders: Order[] }>("/pos/sync-conflicts")
      .then((r) => setConflictCount(r.orders.length))
      .catch(() => setConflictCount(0));
  }, [isManager, isOnline]);

  useEffect(() => {
    load().catch(() => setError("Could not load menu."));
    void api<{
      offlinePosEnabled?: boolean;
      maxCashierDiscountPercent: number;
      discountReasonOptions: string[];
      voidReasonOptions: string[];
    }>("/admin/approval/controls")
      .then((c) => {
        setOfflinePosEnabled(c.offlinePosEnabled !== false);
        setMaxCashierDiscountPercent(Number(c.maxCashierDiscountPercent) || 10);
        setDiscountReasons(Array.isArray(c.discountReasonOptions) ? c.discountReasonOptions.map(String) : []);
        setVoidReasons(Array.isArray(c.voidReasonOptions) ? c.voidReasonOptions.map(String) : []);
      })
      .catch(() => null);
  }, [load]);

  useEffect(() => {
    setPosFullscreen(readPosFullscreen());
    const onFs = () => setPosFullscreen(readPosFullscreen());
    window.addEventListener("pos-fullscreen-change", onFs);
    return () => window.removeEventListener("pos-fullscreen-change", onFs);
  }, []);

  const refreshHolds = useCallback(async () => {
    try {
      const res = await api<{ holds: { id: string; label: string | null; payload: unknown; createdAt: string }[] }>(
        "/pos/holds?shared=1"
      );
      setHolds(res.holds);
      setHoldCount(res.holds.length);
    } catch {
      setHolds([]);
      setHoldCount(0);
    }
  }, []);

  useEffect(() => {
    void refreshHolds();
  }, [refreshHolds]);

  useEffect(() => {
    void pendingQueueCount().then(setPendingSyncCount).catch(() => setPendingSyncCount(0));
  }, [isOnline]);

  useEffect(() => {
    setPinnedIds(readPinnedMenuIds(branchKey));
  }, [branchKey]);

  useEffect(() => {
    const onPins = () => setPinnedIds(readPinnedMenuIds(branchKey));
    const onDensity = () => setMenuDensity(readPosMenuDensity());
    window.addEventListener("pos-menu-pins-change", onPins);
    window.addEventListener("pos-menu-density-change", onDensity);
    return () => {
      window.removeEventListener("pos-menu-pins-change", onPins);
      window.removeEventListener("pos-menu-density-change", onDensity);
    };
  }, [branchKey]);

  useEffect(() => {
    if (!isOnline || selection === "all") {
      setPopularIds([]);
      return;
    }
    void api<{ popular: { menuItemId: string; quantity: number }[] }>("/pos/popular-menu")
      .then((r) => setPopularIds(r.popular.map((p) => p.menuItemId)))
      .catch(() => setPopularIds([]));
  }, [isOnline, selection]);

  const categories = useMemo(() => {
    const cats = [...new Set(menu.map((m) => m.category))].sort();
    return ["All", ...cats];
  }, [menu]);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const checkoutCustomerName = resolvePosCustomerNameForCheckout(mode, customerName);

  function selectMode(next: PosMode) {
    setMode(next);
    if (next === "DELIVERY" && isWalkInCustomerName(customerName)) {
      setCustomerName("");
    } else if (next !== "DELIVERY" && !customerName.trim()) {
      setCustomerName(POS_WALK_IN_LABEL);
    }
  }

  function openCustomerDetails() {
    if (mode === "DELIVERY" && isWalkInCustomerName(customerName)) {
      setCustomerName("");
    }
    setShowDetails(true);
  }
  const taxSettings = {
    taxEnabled: publicStore?.settings.taxEnabled,
    taxPercent: publicStore?.settings.taxPercent,
    taxIncluded: publicStore?.settings.taxIncluded,
    pricesIncludeTax: publicStore?.settings.pricesIncludeTax,
    serviceChargePercent: publicStore?.settings.serviceChargePercent,
    serviceIncluded: publicStore?.settings.serviceIncluded,
  };
  const lineInputs = lines.map((l) => ({ price: l.price, quantity: l.quantity }));
  const rawDeliveryFee =
    mode === "DELIVERY" ? Number(areas.find((a) => a.id === areaId)?.deliveryCharge || 0) : 0;
  const subtotalPreview = lineInputs.reduce((s, l) => s + l.price * l.quantity, 0);
  const deliveryFee =
    mode === "DELIVERY" && freeDeliveryAbove != null && subtotalPreview >= freeDeliveryAbove ? 0 : rawDeliveryFee;
  const pct = Number(discountPercent) || 0;
  const totals = computePosTotalsClient({
    lines: lineInputs,
    deliveryCharge: deliveryFee,
    discountPercent: pct > 0 ? pct : null,
    settings: taxSettings,
  });
  const total = totals.total;
  const chargeBlocked = posChargeBlockedReason({
    linesEmpty: !lines.length,
    mode,
    tableSessionId,
    deliveryAreaId: areaId,
    deliveryAddress,
    customerName,
    customerPhone,
    payment,
    shiftOpen,
    cashTendered,
    total,
    splitRows,
    discountPercent: pct,
    discountReasonCode,
    discountReasonNote,
  });
  const storeTimezone = publicStore?.settings.timezone ?? "Asia/Karachi";
  const posClock = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: storeTimezone,
  });
  const hasPriceOverride = lines.some(
    (l) => l.catalogPrice != null && Math.abs(l.price - l.catalogPrice) > 0.009
  );
  const needsCheckoutApproval =
    !isManager &&
    ((pct > 0 && pct > maxCashierDiscountPercent) || hasPriceOverride);

  function tapItem(item: MenuItem) {
    if (!item.isAvailable) return;
    if (itemHasConfigurableOptions(item) || (item.optionGroups?.length ?? 0) > 0) {
      setConfigItem(item);
      return;
    }
    const cfg = buildQuickAddConfig(item);
    addItem({ item, price: cfg.price, optionIds: cfg.optionIds, optionsLabel: cfg.optionsLabel });
  }

  async function updateItemAvailability(item: MenuItem, isAvailable: boolean) {
    try {
      await setMenuItemStock(item.id, isAvailable);
      setMenu((prev) => prev.map((m) => (m.id === item.id ? { ...m, isAvailable } : m)));
      setActionItem(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update availability.");
    }
  }

  async function placeOrder(approval?: { approverId: string; pin: string }) {
    setError("");
    if (!lines.length) {
      setError("Add items to the cart first.");
      return;
    }
    if (offlineMode) {
      if (mode === "DELIVERY") {
        setError("Delivery is not available offline.");
        return;
      }
      if (payment !== "CASH") {
        setError("Only cash payments work offline.");
        return;
      }
      if (pct > 0 || hasPriceOverride) {
        setError("Discounts and price overrides require an online connection and manager approval.");
        return;
      }
      if (!shiftOpen) {
        setError("You need an open shift (synced while online) before taking cash offline.");
        return;
      }
    }
    if (mode === "DELIVERY" && !areaId) {
      setError("Select a delivery area.");
      return;
    }
    if (mode === "DINE_IN" && !tableSessionId) {
      setError("Select an open table session for dine-in.");
      setShowTablePicker(true);
      return;
    }
    if (pct > 0 && !discountReasonCode.trim()) {
      setError("Select a discount reason.");
      return;
    }
    if (needsCheckoutApproval && !approval) {
      if (offlineMode) {
        setError("Manager approval requires an online connection.");
        return;
      }
      setApprovalFlow("checkout");
      return;
    }
    if (payment === "CASH" && !shiftOpen) {
      setError("Open a cash shift before taking cash payments.");
      return;
    }
    setBusy(true);
    const idempotencyKey = checkoutIdempotencyKey;
    try {
      const payload = buildPosOrderPayload(lines);
      if (offlineMode) {
        const clientOrderId = crypto.randomUUID();
        const offlineLabel = await nextOfflineLabel();
        const deviceLabel = getDeviceLabel();
        const clientCreatedAt = new Date().toISOString();
        const body = {
          ...payload,
          fulfillmentType: mode,
          customerName: checkoutCustomerName,
          customerPhone: customerPhone || undefined,
          tableNumber: mode === "DINE_IN" ? tableNumber : undefined,
          tableSessionId: mode === "DINE_IN" ? tableSessionId : undefined,
          diningTableId: mode === "DINE_IN" ? diningTableId : undefined,
          waiterId: mode === "DINE_IN" ? waiterId || undefined : undefined,
          notes,
          paymentMethod: "CASH",
          paymentStatus: "PAID",
        };
        await enqueuePosOrder({
          clientOrderId,
          offlineLabel,
          clientCreatedAt,
          deviceLabel,
          clientClaimedTotal: total,
          body,
          status: "pending",
          attempts: 0,
        });
        const pseudo = buildOfflinePrintOrder({
          offlineLabel,
          lines,
          total,
          subtotal: totals.subtotal,
          fulfillmentType: mode,
          customerName: checkoutCustomerName,
          customerPhone,
          tableNumber: mode === "DINE_IN" ? tableNumber : undefined,
          notes,
        });
        setLastOrder(pseudo);
        clear();
        setNotes("");
        setMobileView("menu");
        printReceipt(pseudo, store, { cashier: user?.name, offlinePending: true });
        return;
      }
      if (chargeBlocked) {
        setError(chargeBlocked);
        return;
      }
      const tenderedNum = cashTendered.trim() ? Number(cashTendered) : undefined;
      const payments = buildPaymentsPayload({
        rows: splitRows,
        total,
        singleMethod: payment,
        cashTendered: tenderedNum,
      });
      const order = await api<Order>("/pos", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          fulfillmentType: mode,
          deliveryAreaId: mode === "DELIVERY" ? areaId : undefined,
          deliveryAddress: mode === "DELIVERY" ? deliveryAddress : undefined,
          customerName: checkoutCustomerName,
          customerPhone: customerPhone || undefined,
          tableNumber: mode === "DINE_IN" ? tableNumber : undefined,
          tableSessionId: mode === "DINE_IN" ? tableSessionId : undefined,
          diningTableId: mode === "DINE_IN" ? diningTableId : undefined,
          waiterId: mode === "DINE_IN" ? waiterId || undefined : undefined,
          notes,
          paymentMethod: payments[0]?.method ?? payment,
          paymentStatus: "PAID",
          clientTotal: total,
          idempotencyKey,
          payments,
          discountPercent: pct > 0 ? pct : undefined,
          discountReasonCode: pct > 0 ? discountReasonCode : undefined,
          discountReasonNote: pct > 0 ? discountReasonNote : undefined,
          approval,
        }),
      });
      setLastOrder(order);
      const cashRow = payments.find((p) => p.method === "CASH");
      const changeDue =
        cashRow?.changeGiven ??
        (cashRow?.tendered != null ? Math.max(0, cashRow.tendered - cashRow.amount) : undefined);
      setSuccessToast({ orderNumber: order.orderNumber, change: changeDue });
      setCheckoutIdempotencyKey(crypto.randomUUID());
      setCashTendered("");
      setSplitRows([]);
      clear();
      setNotes("");
      setDiscountPercent("");
      setDiscountReasonCode("");
      setDiscountReasonNote("");
      setApprovalFlow(null);
      setMobileView("menu");
      try {
        printReceipt(order, store, { cashier: user?.name });
      } catch {
        setError("Order saved but printing failed — use Reprint.");
      }
      void syncPosQueue();
    } catch (err) {
      if (err instanceof ApiError && err.code === "APPROVAL_REQUIRED") {
        setApprovalFlow("checkout");
      } else {
        setError(err instanceof Error ? err.message : "Could not place order.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function voidLastOrder(approval?: { approverId: string; pin: string }) {
    if (!isOnline) {
      setError("Void requires an online connection and manager approval.");
      return;
    }
    if (!lastOrder || lastOrder.status === "CANCELLED") return;
    if (lastOrder.id.startsWith("offline-")) {
      setError("This receipt is offline-only — remove it from the sync queue if needed.");
      return;
    }
    if (!voidReasonCode.trim()) {
      setError("Select a void reason.");
      return;
    }
    if (!isManager && !approval) {
      setApprovalFlow("void");
      return;
    }
    setBusy(true);
    try {
      const order = await api<Order>(`/pos/${lastOrder.id}/void`, {
        method: "POST",
        body: JSON.stringify({
          voidReasonCode,
          voidReasonNote,
          approval,
        }),
      });
      setLastOrder(order);
      setApprovalFlow(null);
      setVoidReasonCode("");
      setVoidReasonNote("");
    } catch (err) {
      if (err instanceof ApiError && err.code === "APPROVAL_REQUIRED") {
        setApprovalFlow("void");
      } else {
        setError(err instanceof Error ? err.message : "Could not void order.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function reprintLast() {
    if (!lastOrder) return;
    try {
      const data = await api<{ order: Order; store: typeof store }>(`/pos/receipt/${lastOrder.id}`);
      printReceipt(data.order, data.store, { cashier: user?.name });
    } catch {
      printReceipt(lastOrder, store, { cashier: user?.name });
    }
  }

  function snapshotCartPayload() {
    return {
      lines,
      mode,
      customerName,
      customerPhone,
      tableNumber,
      tableSessionId,
      diningTableId,
      waiterId,
      deliveryAddress,
      areaId,
      notes,
      discountPercent,
      discountReasonCode,
      discountReasonNote,
      payment,
    };
  }

  async function parkCurrentOrder() {
    if (!lines.length) return;
    try {
      await api("/pos/holds", {
        method: "POST",
        body: JSON.stringify({ payload: snapshotCartPayload(), label: `Hold · ${itemCount} items` }),
      });
      clear();
      setNotes("");
      setSplitRows([]);
      void refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not hold order.");
    }
  }

  async function resumeHold(holdId: string) {
    try {
      const { hold } = await api<{ hold: { payload: ReturnType<typeof snapshotCartPayload> } }>(
        `/pos/holds/${holdId}/resume`,
        { method: "POST" }
      );
      const p = hold.payload;
      usePosCart.setState({ lines: p.lines });
      setMode(p.mode);
      setCustomerName(p.customerName);
      setCustomerPhone(p.customerPhone);
      setTableNumber(p.tableNumber);
      setTableSessionId(p.tableSessionId);
      setDiningTableId(p.diningTableId);
      setWaiterId(p.waiterId);
      setDeliveryAddress(p.deliveryAddress);
      setAreaId(p.areaId);
      setNotes(p.notes);
      setDiscountPercent(p.discountPercent);
      setDiscountReasonCode(p.discountReasonCode);
      setDiscountReasonNote(p.discountReasonNote);
      setPayment(p.payment);
      setHoldsOpen(false);
      void refreshHolds();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume hold.");
    }
  }

  function requestClearCart() {
    setClearedSnapshot([...lines]);
    clear();
    setClearUndoUntil(Date.now() + 10_000);
  }

  function undoClear() {
    if (!clearedSnapshot) return;
    usePosCart.setState({ lines: clearedSnapshot });
    setClearedSnapshot(null);
    setClearUndoUntil(0);
  }

  function beginPriceOverride(line: PosLine) {
    if (!isManager) {
      setPriceOverridePending({ id: line.id, price: line.price });
      setPriceEditLine({ id: line.id, price: line.price });
      return;
    }
    setPriceEditLine({ id: line.id, price: line.price });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "F2") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setLineSheet(null);
        setShowTablePicker(false);
        setHoldsOpen(false);
      }
      if (e.key === "F9" && !chargeBlocked && lines.length) {
        e.preventDefault();
        void placeOrder();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chargeBlocked, lines.length]);

  const cartTotals = { ...totals, deliveryFee, rawDeliveryFee };

  const renderCartPanel = (sheetMode: boolean) => (
    <PosCartPanel
      sheetMode={sheetMode}
      mobileBack={() => setMobileView("menu")}
      itemCount={itemCount}
      mode={mode}
      modes={MODES}
      tableLabel={tableSessionId ? tableNumber : null}
      onOpenTable={() => setShowTablePicker(true)}
      onOpenCustomer={openCustomerDetails}
      onHold={() => void parkCurrentOrder()}
      onShowHolds={() => {
        setHoldsOpen(true);
        void refreshHolds();
      }}
      holdCount={holdCount}
      lines={lines}
      onLineTap={setLineSheet}
      onQty={setQty}
      onClearRequest={requestClearCart}
      totals={cartTotals}
      maxCashierDiscountPercent={maxCashierDiscountPercent}
      discountPercent={discountPercent}
      discountReasonCode={discountReasonCode}
      discountReasonNote={discountReasonNote}
      discountReasons={discountReasons}
      onDiscountPercent={setDiscountPercent}
      onDiscountReasonCode={setDiscountReasonCode}
      onDiscountReasonNote={setDiscountReasonNote}
      kitchenNote={notes}
      onKitchenNote={setNotes}
      payment={payment}
      onPayment={setPayment}
      cashTendered={cashTendered}
      onCashTendered={setCashTendered}
      splitRows={splitRows}
      onSplitRows={setSplitRows}
      shiftOpen={shiftOpen}
      onShiftChange={setShiftOpen}
      cashierName={user?.name ?? "Cashier"}
      deliveryAreas={areas}
      deliveryAreaId={areaId}
      onDeliveryAreaId={setAreaId}
      deliveryAddress={deliveryAddress}
      onDeliveryAddress={setDeliveryAddress}
      customerName={customerName}
      onCustomerName={setCustomerName}
      customerPhone={customerPhone}
      onCustomerPhone={setCustomerPhone}
      chargeBlocked={chargeBlocked}
      busy={busy}
      onCharge={() => void placeOrder()}
      lastOrder={lastOrder}
      onReprint={reprintLast}
      onOverridePrice={beginPriceOverride}
    />
  );

  const mobileCartOpen = mobileView === "cart";

  return (
    <div
      className={`flex h-[100dvh] max-w-[100vw] flex-col overflow-x-hidden overflow-y-hidden bg-[#fffaf5] dark:bg-stone-950 ${
        posFullscreen
          ? "fixed inset-0 z-30"
          : "lg:-m-4 lg:h-[calc(100dvh-4.5rem)] lg:rounded-2xl lg:border lg:border-stone-100 lg:shadow-sm dark:lg:border-stone-700"
      }`}
    >
      {/* Header */}
      <header
        className={`shrink-0 items-center justify-between gap-2 border-b border-orange-100/80 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-900 sm:px-4 sm:py-3 ${
          mobileCartOpen ? "hidden md:flex" : "flex"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-orange-600 text-white shadow-md sm:h-10 sm:w-10">
            <UtensilsCrossed size={16} className="sm:hidden" />
            <UtensilsCrossed size={18} className="hidden sm:block" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-50">Point of Sale</p>
            <p className="truncate text-[11px] text-stone-500 dark:text-stone-400">
              {user?.name ?? "Cashier"} · {posClock}
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-1 rounded-xl bg-orange-50 p-1 ring-1 ring-orange-100 dark:bg-stone-800 dark:ring-stone-600 md:flex">
          {MODES.map((m) => {
            const Icon = m.icon;
            const active = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
                  active ? "bg-stone-900 text-white shadow-sm ring-1 ring-stone-900 dark:bg-stone-100 dark:text-stone-900" : "text-stone-500 dark:text-stone-400"
                }`}
              >
                <Icon size={14} />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <PosHelpButton />
          <PosOfflineBar conflictCount={conflictCount} onPendingChange={setPendingSyncCount} />
          <button
            type="button"
            onClick={() => {
              writePosFullscreen(!posFullscreen);
              setPosFullscreen(!posFullscreen);
            }}
            className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-stone-600 ring-1 ring-stone-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-stone-300 dark:ring-stone-600"
          >
            {posFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="hidden sm:inline">{posFullscreen ? "Exit POS" : "Full screen"}</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileView("cart")}
            className="relative rounded-xl bg-brand-50 px-2.5 py-1.5 ring-1 ring-brand-100 focus-visible:ring-2 focus-visible:ring-brand-500 md:hidden"
          >
            <ShoppingBag size={18} className="text-brand-700" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => void guardedLogout()}
            className="grid h-9 w-9 place-items-center rounded-xl text-stone-500 ring-1 ring-stone-200 lg:hidden"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Mobile mode + view tabs */}
      <div
        className={`shrink-0 flex-col gap-1.5 border-b border-orange-100/80 bg-white px-2 py-2 dark:border-stone-700 dark:bg-stone-900 md:hidden ${
          mobileCartOpen ? "hidden" : "flex"
        }`}
      >
        <div className="flex gap-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => selectMode(m.id)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold ${
                  mode === m.id ? "bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" : "bg-stone-100 text-stone-600 dark:bg-stone-800"
                }`}
              >
                <Icon size={13} />
                {m.short}
              </button>
            );
          })}
        </div>
      </div>

      <PosConnectivityBanner
        offline={offlineMode}
        offlinePosEnabled={offlinePosEnabled}
        pendingCount={pendingSyncCount}
        conflictCount={conflictCount}
        onOpenQueue={() => window.dispatchEvent(new CustomEvent("pos-open-queue"))}
      />

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
      )}
      {!idbOk && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          Offline storage unavailable — POS will not queue orders without internet.
        </div>
      )}
      <div className={`flex min-h-0 flex-1 flex-col md:flex-row ${mobileCartOpen ? "hidden md:flex" : ""}`}>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#fffaf5] dark:bg-stone-950">
          <div className="shrink-0 border-b border-stone-200 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-900">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                ref={searchRef}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-400/30"
                placeholder="Search or scan"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    const q = search.trim().toLowerCase();
                    const hit = menu.find((m) => m.name.toLowerCase() === q);
                    if (hit) {
                      tapItem(hit);
                      setSearch("");
                    }
                  }
                }}
                aria-label="Search menu"
              />
            </div>
          </div>

          <PosMenuBrowser
            menu={menu}
            deals={deals}
            categories={categories}
            category={category}
            onCategory={setCategory}
            search={search}
            density={menuDensity}
            onDensity={(d) => {
              writePosMenuDensity(d);
              setMenuDensity(d);
            }}
            popularIds={popularIds}
            pinnedIds={pinnedIds}
            canMark86={canMark86}
            canPin={isManager}
            onTapItem={tapItem}
            onTapDeal={addDeal}
            onItemLongPress={(item) => setActionItem(item)}
          />
        </section>

        <aside className="hidden h-full min-h-0 w-full shrink-0 border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 md:flex md:h-full md:w-[min(400px,36vw)] md:min-h-0 md:flex-col md:border-l">
          <div className="flex h-full min-h-0 w-full flex-1 flex-col">
            {renderCartPanel(false)}
          </div>
        </aside>
      </div>

      {mobileCartOpen && (
        <div
          className="fixed inset-0 z-[100] flex min-h-0 flex-col bg-white dark:bg-stone-900 md:hidden pt-[env(safe-area-inset-top)]"
          role="dialog"
          aria-label="Cart and checkout"
        >
          {renderCartPanel(true)}
        </div>
      )}

      {!mobileCartOpen && mobileView === "menu" && itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-stone-200 bg-white/95 p-3 backdrop-blur-md md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setMobileView("cart")}
            className="btn-primary flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag size={18} />
              {itemCount} item{itemCount !== 1 ? "s" : ""} · View cart
            </span>
            <span className="flex items-center gap-1">
              {pkr(total)}
              <ChevronRight size={18} />
            </span>
          </button>
        </div>
      )}

      {showTablePicker && mode === "DINE_IN" && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-stone-900 dark:text-stone-50">Dine-in table</h3>
              <button type="button" className="text-sm text-stone-500" onClick={() => setShowTablePicker(false)}>Close</button>
            </div>
            {selection === "all" ? (
              <p className="mt-3 text-sm text-amber-700">Select one branch in the admin header first.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {floorTables.map((t) => (
                  <li key={t.id} className="rounded-xl border border-stone-200 p-3 dark:border-stone-700">
                    <p className="font-semibold">Table {t.label} · {t.status}</p>
                    {t.activeSession ? (
                      <button
                        type="button"
                        className="mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-bold text-white"
                        onClick={() => {
                          setTableSessionId(t.activeSession!.id);
                          setDiningTableId(t.id);
                          setTableNumber(t.label);
                          setWaiterId(
                            t.activeSession!.waiter?.id || (user?.role === "WAITER" ? user.id : "") || ""
                          );
                          setShowTablePicker(false);
                        }}
                      >
                        Use open session ({t.activeSession.guestName})
                      </button>
                    ) : (
                      <div className="mt-2 space-y-2">
                        {t.nextReservation && t.status === "RESERVED" && (
                          <button
                            type="button"
                            className="w-full rounded-lg bg-violet-700 py-2 text-xs font-bold text-white"
                            onClick={async () => {
                              try {
                                const res = await seatReservation(t.nextReservation!.id, {
                                  tableId: t.id,
                                  guestName: t.nextReservation!.customerName,
                                  partySize: t.nextReservation!.partySize,
                                  waiterId: user?.role === "WAITER" ? user.id : waiterId || undefined,
                                });
                                if (res.session) {
                                  setTableSessionId(res.session.id);
                                  setDiningTableId(t.id);
                                  setTableNumber(t.label);
                                  setShowTablePicker(false);
                                  void loadFloor();
                                }
                              } catch (err) {
                                setError(err instanceof Error ? err.message : "Could not seat booking");
                              }
                            }}
                          >
                            Seat booking ({t.nextReservation.customerName})
                          </button>
                        )}
                        <button
                          type="button"
                          className="w-full rounded-lg border border-stone-300 py-2 text-xs font-semibold"
                          disabled={t.status === "NEEDS_CLEANING"}
                          onClick={async () => {
                            try {
                              const res = await openTableSession(t.id, {
                                guestName: customerName,
                                partySize: 2,
                                waiterId: user?.role === "WAITER" ? user.id : undefined,
                                force: walkInForce && isManager,
                              });
                              if (res.session) {
                                setTableSessionId(res.session.id);
                                setDiningTableId(t.id);
                                setTableNumber(t.label);
                                setWalkInForce(false);
                                setShowTablePicker(false);
                                void loadFloor();
                              }
                            } catch (err) {
                              const message = err instanceof Error ? err.message : "Could not open table";
                              if (isManager && message.toLowerCase().includes("soon")) {
                                setWalkInForce(true);
                                setError("Table is reserved soon — enable override below or seat the booking instead.");
                              } else {
                                setError(message);
                              }
                            }
                          }}
                        >
                          Walk-in & seat
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isManager && walkInForce && (
              <label className="mt-3 flex items-center gap-2 text-xs text-amber-800">
                <input type="checkbox" checked={walkInForce} onChange={(e) => setWalkInForce(e.target.checked)} />
                Override “reserved soon” for walk-in
              </label>
            )}
            <p className="mt-2 text-center text-[11px] text-stone-500">
              Close tables from{" "}
              <Link href="/admin/dine-in" className="font-semibold text-brand-600">Dine-in floor</Link> when the bill is done.
            </p>
          </div>
        </div>
      )}

      <InputSheet
        open={Boolean(priceEditLine)}
        title="Override line price"
        label="Unit price (Rs)"
        initialValue={priceEditLine ? String(priceEditLine.price) : ""}
        saving={false}
        onClose={() => setPriceEditLine(null)}
        onConfirm={(v) => {
          if (!priceEditLine) return;
          const n = Number(v);
          if (!isManager) {
            setPriceOverridePending({ id: priceEditLine.id, price: n });
            setPriceEditLine(null);
            setApprovalFlow("price");
            return;
          }
          setLinePrice(priceEditLine.id, n);
          setPriceEditLine(null);
        }}
      />

      <PosCustomerSheet
        open={showDetails}
        onClose={() => setShowDetails(false)}
        mode={mode}
        areas={areas}
        areaId={areaId}
        onAreaId={setAreaId}
        deliveryAddress={deliveryAddress}
        onDeliveryAddress={setDeliveryAddress}
        customerName={customerName}
        onCustomerName={setCustomerName}
        customerPhone={customerPhone}
        onCustomerPhone={setCustomerPhone}
      />

      {holdsOpen && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-4 shadow-xl dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Held orders</h3>
              <button type="button" className="text-sm text-stone-500" onClick={() => setHoldsOpen(false)}>Close</button>
            </div>
            <ul className="mt-3 space-y-2">
              {holds.length === 0 ? (
                <li className="text-sm text-stone-500">No held orders.</li>
              ) : (
                holds.map((h) => (
                  <li key={h.id} className="flex items-center justify-between rounded-xl border border-stone-200 p-3 dark:border-stone-600">
                    <div>
                      <p className="text-sm font-semibold">{h.label ?? "Held order"}</p>
                      <p className="text-[11px] text-stone-500">{new Date(h.createdAt).toLocaleString()}</p>
                    </div>
                    <button type="button" className="btn-primary text-xs" onClick={() => void resumeHold(h.id)}>Resume</button>
                  </li>
                ))
              )}
            </ul>
            {lines.length > 0 && (
              <button type="button" className="btn-ghost mt-3 w-full" onClick={() => void parkCurrentOrder()}>
                Park current cart
              </button>
            )}
          </div>
        </div>
      )}

      <PosItemActionSheet
        item={actionItem}
        pinned={actionItem ? pinnedIds.includes(actionItem.id) : false}
        canMark86={canMark86}
        canPin={isManager}
        onClose={() => setActionItem(null)}
        onMarkSoldOut={() => actionItem && void updateItemAvailability(actionItem, false)}
        onMarkAvailable={() => actionItem && void updateItemAvailability(actionItem, true)}
        onTogglePin={() => {
          if (!actionItem) return;
          togglePinnedMenuId(branchKey, actionItem.id);
          setPinnedIds(readPinnedMenuIds(branchKey));
          setActionItem(null);
        }}
      />

      <PosLineSheet
        open={Boolean(lineSheet)}
        line={lineSheet}
        onClose={() => setLineSheet(null)}
        onNoteChange={(note) => lineSheet && setLineInstructions(lineSheet.id, note)}
        onRemove={() => {
          if (lineSheet) remove(lineSheet.id);
          setLineSheet(null);
        }}
        onEditPrice={() => {
          if (lineSheet) beginPriceOverride(lineSheet);
          setLineSheet(null);
        }}
        canEditModifiers={Boolean(lineSheet?.menuItemId)}
        onEditModifiers={
          lineSheet?.menuItemId
            ? () => {
                const item = menu.find((m) => m.id === lineSheet.menuItemId);
                if (item) setConfigItem(item);
                setLineSheet(null);
              }
            : undefined
        }
      />

      {clearUndoUntil > Date.now() && clearedSnapshot && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-stone-900 px-4 py-2 text-sm text-white shadow-lg lg:bottom-6">
          Cart cleared
          <button type="button" className="font-bold text-brand-300" onClick={undoClear}>Undo</button>
        </div>
      )}

      {successToast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg" role="status">
          Order {successToast.orderNumber} saved
          {successToast.change != null && successToast.change > 0 ? ` · Change ${pkr(successToast.change)}` : ""}
          <button type="button" className="ml-3 text-brand-300" onClick={() => setSuccessToast(null)}>OK</button>
        </div>
      )}

      {approvalFlow === "checkout" && (
        <ManagerApprovalModal
          open
          title="Manager approval required"
          reasonOptions={discountReasons}
          reasonCode={discountReasonCode}
          reasonNote={discountReasonNote}
          onReasonCodeChange={setDiscountReasonCode}
          onReasonNoteChange={setDiscountReasonNote}
          onCancel={() => setApprovalFlow(null)}
          onApproved={(r) => void placeOrder({ approverId: r.approverId, pin: r.pin })}
        />
      )}

      {approvalFlow === "price" && priceOverridePending && (
        <ManagerApprovalModal
          open
          title="Manager approval for price override"
          reasonOptions={discountReasons}
          reasonCode={discountReasonCode}
          reasonNote={discountReasonNote}
          onReasonCodeChange={setDiscountReasonCode}
          onReasonNoteChange={setDiscountReasonNote}
          onCancel={() => {
            setApprovalFlow(null);
            setPriceOverridePending(null);
          }}
          onApproved={() => {
            setLinePrice(priceOverridePending.id, priceOverridePending.price);
            setPriceOverridePending(null);
            setApprovalFlow(null);
          }}
        />
      )}

      {approvalFlow === "void" && (
        <ManagerApprovalModal
          open
          title="Manager approval to void"
          reasonOptions={voidReasons}
          reasonCode={voidReasonCode}
          reasonNote={voidReasonNote}
          onReasonCodeChange={setVoidReasonCode}
          onReasonNoteChange={setVoidReasonNote}
          onCancel={() => setApprovalFlow(null)}
          onApproved={(r) => void voidLastOrder({ approverId: r.approverId, pin: r.pin })}
        />
      )}

      <PosItemSheet item={configItem} onClose={() => setConfigItem(null)} />

      <ConfirmSheet
        open={logoutQueueWarn}
        title="Sign out with pending offline queue?"
        message="Unsynced orders remain on this device until someone syncs or discards them. Only continue if a manager accepts the risk."
        confirmLabel="Sign out anyway"
        danger
        saving={false}
        onClose={() => setLogoutQueueWarn(false)}
        onConfirm={async () => {
          await auditOfflineLogoutOverride();
          setLogoutQueueWarn(false);
          logout();
          router.replace("/login");
        }}
      />
    </div>
  );
}
