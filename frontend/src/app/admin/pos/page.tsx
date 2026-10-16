"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Bike,
  ChevronRight,
  CreditCard,
  LayoutGrid,
  LogOut,
  Minus,
  Plus,
  Printer,
  Search,
  ShoppingBag,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { fetchAllDeals, fetchAllMenuItems } from "@/lib/catalog-api";
import { useAuth } from "@/lib/auth";
import { DEFAULT_STORE_NAME, storeDisplayName } from "@/lib/branding";
import { buildPosOrderPayload, posCartTotal, usePosCart } from "@/lib/pos-cart";
import { buildQuickAddConfig, itemHasConfigurableOptions, menuItemPrice } from "@/lib/menu-price";
import { printReceipt } from "@/lib/print-receipt";
import { pkr } from "@/lib/format";
import { Deal, DeliveryArea, FulfillmentType, MenuItem, Order, PaymentMethod } from "@/lib/types";
import { PosItemSheet } from "@/components/admin/PosItemSheet";
import { ManagerApprovalModal } from "@/components/admin/ManagerApprovalModal";
import { InputSheet } from "@/components/admin/InputSheet";
import { CashShiftPanel } from "@/components/admin/pos/CashShiftPanel";
import { fetchFloor, openTableSession, seatReservation, type FloorTable } from "@/modules/dine-in/api";
import { useBranch } from "@/modules/branches/BranchContext";

type PosMode = FulfillmentType;
type MobileView = "menu" | "cart";

const MODES: { id: PosMode; label: string; short: string; icon: typeof UtensilsCrossed }[] = [
  { id: "DINE_IN", label: "Dine-in", short: "Dine", icon: UtensilsCrossed },
  { id: "PICKUP", label: "Takeaway", short: "Take", icon: ShoppingBag },
  { id: "DELIVERY", label: "Delivery", short: "Deliv", icon: Bike },
];

function PosProductCard({ item, onTap }: { item: MenuItem; onTap: () => void }) {
  const price = menuItemPrice(item);
  const hasOptions = itemHasConfigurableOptions(item) || (item.optionGroups?.length ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={onTap}
      className="group relative flex flex-col overflow-hidden rounded-xl border border-stone-200/80 bg-white text-left shadow-sm transition active:scale-[0.98] dark:border-stone-600 dark:bg-stone-800 sm:rounded-2xl sm:hover:-translate-y-0.5 sm:hover:border-brand-300 sm:hover:shadow-lg dark:sm:hover:border-brand-500"
    >
      <div className="relative h-24 w-full shrink-0 overflow-hidden bg-gradient-to-br from-stone-100 to-stone-200 sm:h-28">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="h-full w-full object-cover sm:transition sm:duration-300 sm:group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-stone-400">
            <UtensilsCrossed size={24} strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-white/95 px-1.5 py-0.5 text-[10px] font-bold text-brand-700 shadow ring-1 ring-brand-100 sm:bottom-2 sm:right-2 sm:px-2 sm:py-1 sm:text-[11px]">
          {pkr(price)}
        </span>
        {hasOptions && (
          <span className="absolute left-1.5 top-1.5 rounded bg-white/95 px-1 py-0.5 text-[8px] font-bold uppercase text-brand-700 shadow-sm sm:left-2 sm:top-2 sm:text-[9px]">
            Opt
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-2 sm:p-2.5">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-stone-900 dark:text-stone-50 sm:text-[13px]">{item.name}</p>
        <p className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-wide text-stone-400 dark:text-stone-400 sm:block">{item.category}</p>
      </div>
    </button>
  );
}

export default function PosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selection } = useBranch();
  const { user, logout } = useAuth();
  const isManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const lines = usePosCart((s) => s.lines);
  const addItem = usePosCart((s) => s.addItem);
  const addDeal = usePosCart((s) => s.addDeal);
  const setQty = usePosCart((s) => s.setQty);
  const remove = usePosCart((s) => s.remove);
  const setLinePrice = usePosCart((s) => s.setLinePrice);
  const clear = usePosCart((s) => s.clear);

  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [areas, setAreas] = useState<DeliveryArea[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<PosMode>("DINE_IN");
  const [customerName, setCustomerName] = useState("Walk-in");
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
  const [clock, setClock] = useState("");
  const [mobileView, setMobileView] = useState<MobileView>("menu");
  const [discountPercent, setDiscountPercent] = useState("");
  const [discountReasonCode, setDiscountReasonCode] = useState("");
  const [discountReasonNote, setDiscountReasonNote] = useState("");
  const [maxCashierDiscountPercent, setMaxCashierDiscountPercent] = useState(10);
  const [discountReasons, setDiscountReasons] = useState<string[]>([]);
  const [voidReasons, setVoidReasons] = useState<string[]>([]);
  const [approvalFlow, setApprovalFlow] = useState<"checkout" | "void" | null>(null);
  const [voidReasonCode, setVoidReasonCode] = useState("");
  const [voidReasonNote, setVoidReasonNote] = useState("");
  const [priceEditLine, setPriceEditLine] = useState<{ id: string; price: number } | null>(null);
  const [shiftOpen, setShiftOpen] = useState(true);

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
    const [m, d, a, s] = await Promise.all([
      fetchAllMenuItems(),
      fetchAllDeals(),
      api<DeliveryArea[]>("/delivery-areas"),
      api<{ settings: { storeName?: string; phone: string; address: string; freeDeliveryAbove?: string | number | null } }>(
        "/settings/public"
      ).catch(() => null),
    ]);
    setMenu(m.filter((i) => i.isAvailable));
    setDeals(d.filter((x) => x.isActive));
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
    load().catch(() => setError("Could not load menu."));
    void api<{
      maxCashierDiscountPercent: number;
      discountReasonOptions: string[];
      voidReasonOptions: string[];
    }>("/admin/approval/controls")
      .then((c) => {
        setMaxCashierDiscountPercent(Number(c.maxCashierDiscountPercent) || 10);
        setDiscountReasons(Array.isArray(c.discountReasonOptions) ? c.discountReasonOptions.map(String) : []);
        setVoidReasons(Array.isArray(c.voidReasonOptions) ? c.voidReasonOptions.map(String) : []);
      })
      .catch(() => null);
  }, [load]);

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit", hour12: true }));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(menu.map((m) => m.category))].sort();
    return ["All", ...cats];
  }, [menu]);

  const filtered = useMemo(() => {
    let list = menu;
    if (category !== "All") list = list.filter((m) => m.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q));
    }
    return list;
  }, [menu, category, search]);

  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = posCartTotal(lines);
  const rawDeliveryFee =
    mode === "DELIVERY" ? Number(areas.find((a) => a.id === areaId)?.deliveryCharge || 0) : 0;
  const deliveryFee =
    mode === "DELIVERY" && freeDeliveryAbove != null && subtotal >= freeDeliveryAbove ? 0 : rawDeliveryFee;
  const pct = Number(discountPercent) || 0;
  const discountPreview = pct > 0 ? ((subtotal + deliveryFee) * pct) / 100 : 0;
  const total = Math.max(0, subtotal + deliveryFee - discountPreview);
  const hasPriceOverride = lines.some(
    (l) => l.catalogPrice != null && Math.abs(l.price - l.catalogPrice) > 0.009
  );
  const needsCheckoutApproval =
    !isManager &&
    ((pct > 0 && pct > maxCashierDiscountPercent) || hasPriceOverride);

  function tapItem(item: MenuItem) {
    if (itemHasConfigurableOptions(item) || (item.optionGroups?.length ?? 0) > 0) {
      setConfigItem(item);
      return;
    }
    const cfg = buildQuickAddConfig(item);
    addItem({ item, price: cfg.price, optionIds: cfg.optionIds, optionsLabel: cfg.optionsLabel });
  }

  async function placeOrder(approval?: { approverId: string; pin: string }) {
    setError("");
    if (!lines.length) {
      setError("Add items to the cart first.");
      return;
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
      setApprovalFlow("checkout");
      return;
    }
    if (payment === "CASH" && !shiftOpen) {
      setError("Open a cash shift before taking cash payments.");
      return;
    }
    setBusy(true);
    try {
      const payload = buildPosOrderPayload(lines);
      const order = await api<Order>("/pos", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          fulfillmentType: mode,
          deliveryAreaId: mode === "DELIVERY" ? areaId : undefined,
          deliveryAddress: mode === "DELIVERY" ? deliveryAddress : undefined,
          customerName,
          customerPhone: customerPhone || undefined,
          tableNumber: mode === "DINE_IN" ? tableNumber : undefined,
          tableSessionId: mode === "DINE_IN" ? tableSessionId : undefined,
          diningTableId: mode === "DINE_IN" ? diningTableId : undefined,
          waiterId: mode === "DINE_IN" ? waiterId || undefined : undefined,
          notes,
          paymentMethod: payment,
          paymentStatus: "PAID",
          discountPercent: pct > 0 ? pct : undefined,
          discountReasonCode: pct > 0 ? discountReasonCode : undefined,
          discountReasonNote: pct > 0 ? discountReasonNote : undefined,
          approval,
        }),
      });
      setLastOrder(order);
      clear();
      setNotes("");
      setDiscountPercent("");
      setDiscountReasonCode("");
      setDiscountReasonNote("");
      setApprovalFlow(null);
      setMobileView("menu");
      printReceipt(order, store, { cashier: user?.name });
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
    if (!lastOrder || lastOrder.status === "CANCELLED") return;
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

  const cartPanel = (
    <>
      <div className="flex shrink-0 items-center justify-between border-b border-orange-100/80 bg-orange-50/50 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/80 sm:px-4 sm:py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileView("menu")}
            className="grid h-8 w-8 place-items-center rounded-lg bg-white text-stone-700 ring-1 ring-stone-200 lg:hidden"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-sm font-bold text-stone-900 dark:text-stone-50">Current order</p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {itemCount} item{itemCount !== 1 ? "s" : ""} · {MODES.find((m) => m.id === mode)?.label}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {lines.length > 0 && (
            <button type="button" onClick={clear} className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold text-stone-700 ring-1 ring-stone-200"
          >
            {showDetails ? "Hide" : "Customer"}
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-orange-100/80 px-3 py-2 dark:border-stone-700">
        <CashShiftPanel paymentMethod={payment} onShiftChange={setShiftOpen} />
      </div>

      {showDetails && (
        <div className="shrink-0 space-y-2 border-b border-orange-100/80 bg-[#fffaf5] px-3 py-3">
          <input className="input h-9 text-sm" placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          <input className="input h-9 text-sm" placeholder="Phone (optional)" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          {mode === "DINE_IN" && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowTablePicker(true)}
                className="flex w-full items-center justify-between rounded-xl border border-brand-200 bg-brand-50/80 px-3 py-2 text-left text-sm font-semibold text-brand-900"
              >
                <span className="flex items-center gap-2">
                  <LayoutGrid size={16} />
                  {tableSessionId ? `Table ${tableNumber}` : "Select table"}
                </span>
                <ChevronRight size={16} />
              </button>
              {waiterId && (
                <p className="text-[11px] text-stone-500">
                  Waiter: {floorWaiters.find((w) => w.id === waiterId)?.name ?? "—"}
                </p>
              )}
            </div>
          )}
          {mode === "DELIVERY" && (
            <>
              <select className="input h-9 text-sm" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} (+{pkr(a.deliveryCharge)})</option>
                ))}
              </select>
              <input className="input h-9 text-sm" placeholder="Delivery address" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
            </>
          )}
          <input className="input h-9 text-sm" placeholder="Order notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      )}

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {lines.length === 0 ? (
          <li className="flex min-h-[120px] flex-col items-center justify-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 px-4 py-8 text-center sm:min-h-[160px]">
            <ShoppingBag size={28} className="text-orange-300" strokeWidth={1.5} />
            <p className="mt-3 text-sm font-semibold text-stone-500">Cart is empty</p>
            <p className="mt-1 text-xs text-stone-400">Tap items from the menu to add</p>
          </li>
        ) : (
          lines.map((l) => (
            <li key={l.id} className="flex items-start gap-2 rounded-xl border border-orange-100 bg-[#fffaf5] p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold leading-snug text-stone-900">{l.name}</p>
                {l.optionsLabel && l.optionsLabel !== l.name && (
                  <p className="mt-0.5 text-[10px] text-stone-500">{l.optionsLabel}</p>
                )}
                <p className="mt-1 text-xs font-bold text-brand-700">{pkr(l.price * l.quantity)}</p>
                {l.catalogPrice != null && Math.abs(l.price - l.catalogPrice) > 0.009 && (
                  <p className="text-[10px] text-amber-700">Price override</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-amber-200 bg-white text-[10px] font-bold text-amber-800"
                  onClick={() => setPriceEditLine({ id: l.id, price: l.price })}
                  title="Override price"
                >
                  Rs
                </button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white" onClick={() => setQty(l.id, l.quantity - 1)}>
                  <Minus size={14} />
                </button>
                <span className="w-5 text-center text-sm font-black tabular-nums">{l.quantity}</span>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-stone-200 bg-white" onClick={() => setQty(l.id, l.quantity + 1)}>
                  <Plus size={14} />
                </button>
                <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-rose-200 bg-white text-rose-600" onClick={() => remove(l.id)}>
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          ))
        )}
      </ul>

      <div className="shrink-0 border-t border-orange-100/80 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-stone-700 dark:bg-stone-900 sm:p-4">
        <div className="rounded-2xl bg-orange-50/60 p-3 ring-1 ring-orange-100 dark:bg-stone-800/80 dark:ring-stone-600">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-stone-600 dark:text-stone-300">
              <span>Subtotal</span>
              <span className="font-medium tabular-nums">{pkr(subtotal)}</span>
            </div>
            {mode === "DELIVERY" && rawDeliveryFee > 0 && deliveryFee === 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Delivery</span>
                <span className="font-medium">Free</span>
              </div>
            )}
            {deliveryFee > 0 && (
              <div className="flex justify-between text-stone-600">
                <span>Delivery</span>
                <span className="font-medium tabular-nums">{pkr(deliveryFee)}</span>
              </div>
            )}
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <input
                className="input h-9 text-sm"
                type="number"
                min={0}
                max={100}
                placeholder={`Discount % (max ${maxCashierDiscountPercent} w/o PIN)`}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
              <select
                className="input h-9 text-sm"
                value={discountReasonCode}
                onChange={(e) => setDiscountReasonCode(e.target.value)}
              >
                <option value="">Discount reason…</option>
                {discountReasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            {discountPreview > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Discount</span>
                <span className="font-medium tabular-nums">−{pkr(discountPreview)}</span>
              </div>
            )}
            <div className="flex items-end justify-between border-t border-orange-100 pt-2 dark:border-stone-600">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-300">Total due</span>
              <span className="text-2xl font-black tabular-nums text-brand-700 dark:text-brand-300">{pkr(total)}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPayment("CASH")}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ring-1 ${
              payment === "CASH" ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white text-stone-600 ring-stone-200"
            }`}
          >
            <Banknote size={16} /> Cash
          </button>
          <button
            type="button"
            onClick={() => setPayment("CARD")}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold ring-1 ${
              payment === "CARD" ? "bg-violet-600 text-white ring-violet-600" : "bg-white text-stone-600 ring-stone-200"
            }`}
          >
            <CreditCard size={16} /> Card
          </button>
        </div>

        <button
          type="button"
          disabled={busy || !lines.length}
          onClick={() => void placeOrder()}
          className="btn-primary mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold disabled:opacity-40 sm:h-14 sm:text-base"
        >
          {busy ? "Processing…" : (
            <>
              <Printer size={18} />
              Charge &amp; Print · {pkr(total)}
            </>
          )}
        </button>

        {lastOrder && (
          <div className="mt-2 space-y-2">
            <button
              type="button"
              onClick={reprintLast}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-600"
            >
              <Printer size={14} /> Reprint {lastOrder.orderNumber}
            </button>
            {lastOrder.status !== "CANCELLED" && (
              <>
                <select
                  className="input h-9 w-full text-sm"
                  value={voidReasonCode}
                  onChange={(e) => setVoidReasonCode(e.target.value)}
                >
                  <option value="">Void reason…</option>
                  {voidReasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void voidLastOrder()}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 text-xs font-semibold text-rose-700"
                >
                  <Trash2 size={14} /> Void {lastOrder.orderNumber}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[#fffaf5] dark:bg-stone-950 lg:-m-4 lg:h-[calc(100dvh-4.5rem)] lg:rounded-2xl lg:border lg:border-orange-100/80 lg:shadow-sm dark:lg:border-stone-700">
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-orange-100/80 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-900 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-orange-600 text-white shadow-md sm:h-10 sm:w-10">
            <UtensilsCrossed size={16} className="sm:hidden" />
            <UtensilsCrossed size={18} className="hidden sm:block" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-stone-900 dark:text-stone-50">Point of Sale</p>
            <p className="hidden text-[11px] text-stone-500 dark:text-stone-400 sm:block">{store.name} · Counter</p>
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
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold ${
                  active ? "bg-white text-brand-800 shadow-sm ring-1 ring-orange-100 dark:bg-stone-700 dark:text-brand-200 dark:ring-stone-600" : "text-stone-500 dark:text-stone-400"
                }`}
              >
                <Icon size={14} />
                {m.label}
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <p className="hidden text-sm font-bold tabular-nums text-stone-700 sm:block">{clock}</p>
          <button
            type="button"
            onClick={() => setMobileView("cart")}
            className="relative rounded-xl bg-brand-50 px-2.5 py-1.5 ring-1 ring-brand-100 lg:hidden"
          >
            <ShoppingBag size={18} className="text-brand-700" />
            {itemCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
          <div className="hidden rounded-xl bg-brand-50 px-3 py-2 text-center ring-1 ring-brand-100 lg:block">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-600">Cart</p>
            <p className="text-lg font-black tabular-nums leading-none text-brand-800">{itemCount}</p>
          </div>
          <button
            type="button"
            onClick={() => { logout(); router.replace("/login"); }}
            className="grid h-9 w-9 place-items-center rounded-xl text-stone-500 ring-1 ring-stone-200 lg:hidden"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Mobile mode + view tabs */}
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-orange-100/80 bg-white px-2 py-2 dark:border-stone-700 dark:bg-stone-900 md:hidden">
        <div className="flex gap-1">
          {MODES.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-bold ${
                  mode === m.id ? "bg-brand-600 text-white" : "bg-orange-50 text-stone-600"
                }`}
              >
                <Icon size={13} />
                {m.short}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1 rounded-xl bg-stone-100 p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileView("menu")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
              mobileView === "menu" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
            }`}
          >
            <LayoutGrid size={14} /> Menu
          </button>
          <button
            type="button"
            onClick={() => setMobileView("cart")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold ${
              mobileView === "cart" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500"
            }`}
          >
            <ShoppingBag size={14} /> Cart ({itemCount})
          </button>
        </div>
      </div>

      {error && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Menu */}
        <section
          className={`min-h-0 min-w-0 flex-1 flex-col bg-[#fffaf5] dark:bg-stone-950 ${
            mobileView === "cart" ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="shrink-0 border-b border-stone-200 bg-white px-3 py-2.5 dark:border-stone-700 dark:bg-stone-900">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                className="w-full rounded-xl border border-stone-200 bg-stone-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white focus:ring-2 focus:ring-brand-400/30"
                placeholder="Search menu…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold sm:px-3.5 sm:text-xs ${
                    category === c ? "bg-brand-600 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {deals.length > 0 && (
            <div className="shrink-0 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2 dark:border-stone-700 dark:from-stone-900 dark:to-stone-800">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Deals</p>
              <div className="flex gap-2 overflow-x-auto pb-0.5">
                {deals.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => addDeal(d)}
                    className="flex shrink-0 items-center gap-2 rounded-xl border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold"
                  >
                    {d.title}
                    <span className="rounded-md bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">{pkr(d.dealPrice)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto p-2 pb-20 sm:p-3 lg:pb-3">
            {filtered.length === 0 ? (
              <div className="grid min-h-[200px] place-items-center rounded-2xl border border-dashed border-stone-300 bg-white text-center">
                <p className="text-sm font-semibold text-stone-500">No items found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {filtered.map((item) => (
                  <PosProductCard key={item.id} item={item} onTap={() => tapItem(item)} />
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Cart — side panel on desktop, full screen tab on mobile */}
        <aside
          className={`w-full shrink-0 flex-col border-orange-100/80 bg-white dark:border-stone-700 dark:bg-stone-900 lg:flex lg:w-[380px] lg:border-l ${
            mobileView === "menu" ? "hidden lg:flex" : "flex min-h-0 flex-1"
          }`}
        >
          {cartPanel}
        </aside>
      </div>

      {/* Floating cart bar — mobile menu view only */}
      {mobileView === "menu" && itemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-orange-200 bg-white/95 p-3 backdrop-blur-md lg:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setMobileView("cart")}
            className="btn-primary flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-sm font-bold"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag size={18} />
              {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1">
              {pkr(total)}
              <ChevronRight size={18} />
            </span>
          </button>
        </div>
      )}

      {showTablePicker && mode === "DINE_IN" && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-stone-950/50 p-4 sm:items-center">
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
          if (priceEditLine) setLinePrice(priceEditLine.id, Number(v));
          setPriceEditLine(null);
        }}
      />

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
    </div>
  );
}
