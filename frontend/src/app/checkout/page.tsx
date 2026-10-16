"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Bike, ExternalLink, MapPin, ShieldCheck, Store } from "lucide-react";
import { StoreShell } from "@/components/StoreShell";
import { useAuth } from "@/lib/auth";
import { buildOrderPayload, friendlyOrderError, pruneStaleCartLines } from "@/lib/cart-validate";
import { cartTotal, useCart } from "@/lib/cart";
import { api } from "@/lib/api";
import { loadCheckoutProfile, saveCheckoutProfile } from "@/lib/checkout-profile";
import { saveGuestOrderToken } from "@/lib/guest-order";
import { useFulfillment } from "@/lib/fulfillment";
import { pkr } from "@/lib/format";
import { storeDisplayName } from "@/lib/branding";
import { branchPickupLabel } from "@/lib/storefront-branches";
import { useStore } from "@/lib/store";
import { useStoreOpen } from "@/lib/use-store-open";
import { getCheckoutLocation } from "@/lib/geolocation";
import { Order } from "@/lib/types";
import { quoteCharges } from "@/lib/charges";

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const store = useStore();
  const { isOpen: storeOpen, closedMessage } = useStoreOpen();
  const items = useCart((s) => s.items);
  const clear = useCart((s) => s.clear);
  const remove = useCart((s) => s.remove);
  const subtotal = cartTotal(items);
  const {
    hasChosen,
    mode,
    areaId,
    areaName,
    deliveryCharge,
    branchId,
    branchName,
    branchAddress,
    setOpenModal,
  } = useFulfillment();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [cartNotice, setCartNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [cartChecked, setCartChecked] = useState(false);
  const idempotencyKey = useMemo(() => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `chk-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }, []);

  const isDelivery = mode === "DELIVERY";
  const settings = store?.settings;
  const pickupAddress =
    branchName && branchAddress
      ? branchPickupLabel({ name: branchName, address: branchAddress })
      : branchName
        ? branchName
        : settings?.address
          ? `${storeDisplayName(settings)} — ${settings.address}`
          : "Restaurant pickup";
  const minimumOrder = Number(settings?.minimumOrder ?? 0);
  const freeAbove = settings?.freeDeliveryAbove != null ? Number(settings.freeDeliveryAbove) : null;
  const qualifiesFreeDelivery = freeAbove != null && subtotal >= freeAbove;
  const effectiveDelivery = isDelivery && !qualifiesFreeDelivery ? deliveryCharge : 0;
  const quoted = quoteCharges(subtotal, effectiveDelivery, settings ?? {});
  const grandTotal = quoted.total;
  const belowMinimum = minimumOrder > 0 && subtotal < minimumOrder;
  const storeClosed = !storeOpen;
  const cashOn = settings?.acceptCash !== false;
  const cardOn = settings?.acceptCard !== false;

  const mapsUrl = useMemo(() => {
    if (!settings?.latitude || !settings?.longitude) return null;
    const lat = settings.latitude;
    const lng = settings.longitude;
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }, [settings]);

  useEffect(() => {
    if (!hasChosen) setOpenModal(true);
  }, [hasChosen, setOpenModal]);

  useEffect(() => {
    const saved = loadCheckoutProfile();
    if (user) {
      setName(user.name);
      setPhone(user.phone || "");
      setEmail(user.email || saved?.email || "");
      setAddress(saved?.address || "");
      setNotes(saved?.notes || "");
      return;
    }
    if (saved) {
      setName(saved.name);
      setPhone(saved.phone);
      setEmail(saved.email);
      setAddress(saved.address);
      setNotes(saved.notes || "");
    }
  }, [user]);

  const autoConfirm = settings?.autoConfirmOrders ?? false;

  useEffect(() => {
    if (!items.length) {
      setCartChecked(true);
      router.replace("/menu");
      return;
    }
    pruneStaleCartLines(items, remove)
      .then((removed) => {
        if (removed > 0) {
          setCartNotice(
            `Removed ${removed} unavailable item${removed === 1 ? "" : "s"} from your bag. Please review before ordering.`
          );
        }
      })
      .catch(() => null)
      .finally(() => setCartChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- validate once on checkout load

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (items.length === 0) return;
    if (storeClosed) {
      setError(closedMessage || "We are currently closed.");
      return;
    }
    if (isDelivery && !cashOn) {
      setError("Cash on delivery is not available right now.");
      return;
    }
    if (belowMinimum) {
      setError(`Minimum order is ${pkr(minimumOrder)}. Add more items to continue.`);
      return;
    }
    if (!hasChosen) {
      setOpenModal(true);
      return;
    }
    if (isDelivery && !areaId) {
      setError("Please select a delivery area.");
      setOpenModal(true);
      return;
    }
    if (!branchId) {
      setError("Please choose a pickup or delivery location.");
      setOpenModal(true);
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Enter a valid phone number with at least 10 digits (e.g. 0300 1234567).");
      return;
    }
    const payload = buildOrderPayload(items);
    if (!payload.items.length && !payload.deals.length) {
      setError("Your bag has no valid items. Go back to the menu and add items again.");
      return;
    }

    setBusy(true);
    setLocating(true);
    try {
      const location = await getCheckoutLocation();
      setLocating(false);
      const order = await api<Order>("/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          deliveryAddress: isDelivery ? address : pickupAddress,
          fulfillmentType: mode,
          deliveryAreaId: isDelivery ? areaId : undefined,
          branchId,
          notes,
          items: payload.items,
          deals: payload.deals,
          idempotencyKey,
          ...(location
            ? {
                customerLatitude: location.latitude,
                customerLongitude: location.longitude,
                customerLocationAccuracy: location.accuracy,
              }
            : {}),
        }),
      });
      saveCheckoutProfile({ name, phone, email, address: isDelivery ? address : "", notes });
      clear();
      if (order.guestAccessToken) {
        saveGuestOrderToken(order.id, order.guestAccessToken);
      }
      router.push(`/orders/${order.id}`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Could not place order";
      setError(friendlyOrderError(raw));
      if (raw.includes("unavailable")) {
        const removed = await pruneStaleCartLines(useCart.getState().items, remove).catch(() => 0);
        if (removed > 0) {
          setCartNotice(`Removed ${removed} unavailable item${removed === 1 ? "" : "s"} from your bag.`);
        }
      }
    } finally {
      setLocating(false);
      setBusy(false);
    }
  }

  const estimateMin = isDelivery
    ? settings?.deliveryEstimateMin ?? 45
    : settings?.pickupEstimateMin ?? 20;

  return (
    <StoreShell>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 pb-28 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:pb-16">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-4xl">Checkout</h1>
            <p className="text-sm text-stone-500">No account needed — just your details.</p>
          </div>

          <div className="space-y-3">
          {storeClosed && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {closedMessage}
            </p>
          )}
          {belowMinimum && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Minimum order is {pkr(minimumOrder)}. Add {pkr(minimumOrder - subtotal)} more to continue.
            </p>
          )}
          {freeAbove != null && (
            <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {qualifiesFreeDelivery
                ? "You qualify for free delivery!"
                : `Free delivery on orders above ${pkr(freeAbove)}`}
            </p>
          )}
          {cartNotice && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {cartNotice}
            </p>
          )}
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
          </div>

          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="flex w-full items-center gap-3 rounded-2xl border border-orange-100 bg-white p-4 text-left transition hover:border-brand-200"
          >
            {isDelivery ? (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <Bike size={18} />
              </span>
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-stone-100 text-stone-700">
                <Store size={18} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{isDelivery ? "Delivery" : "Takeaway"}</p>
              <p className="truncate text-xs text-stone-500">
                {isDelivery
                  ? [areaName, branchName].filter(Boolean).join(" · ") || "Select area"
                  : pickupAddress}
              </p>
              <p className="text-xs text-brand-600">Est. {estimateMin} min</p>
            </div>
            <span className="text-xs font-semibold text-brand-700">Change</span>
          </button>

          <div className="space-y-3">
            {!autoConfirm && (
              <p className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3.5 text-sm leading-relaxed text-orange-950">
                We&apos;ll call you to verify this order before the kitchen starts preparing it.
              </p>
            )}

            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm leading-relaxed text-emerald-900">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-600" size={18} />
              <p>Your details are saved on this device for faster checkout next time — no account needed.</p>
            </div>
          </div>

          <div className="space-y-4">
          <input className="input" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            className="input"
            placeholder="Phone (e.g. 0300 1234567)"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            minLength={10}
            required
          />
          <input
            className="input"
            placeholder="Email (for order updates)"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {isDelivery ? (
            <textarea
              className="input min-h-24"
              placeholder="House / street / landmark in your area"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
            />
          ) : (
            <div className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 shrink-0 text-brand-600" size={16} />
                <p>Takeaway from <strong>{pickupAddress}</strong>. We will call when your order is ready.</p>
              </div>
              {mapsUrl && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                >
                  Open in Google Maps <ExternalLink size={12} />
                </a>
              )}
            </div>
          )}
          <textarea
            className="input min-h-20"
            placeholder="Order notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          </div>

          <button
            className="btn-primary mt-2 h-14 w-full text-base"
            disabled={busy || !cartChecked || items.length === 0 || storeClosed || belowMinimum || (isDelivery && !cashOn)}
          >
            {locating ? "Getting location…" : busy ? "Placing…" : `Place order · ${pkr(grandTotal)}`}
          </button>
        </form>
        <aside className="card h-fit p-6 md:sticky md:top-24">
          <p className="font-display text-2xl">Bag</p>
          {items.length === 0 ? (
            <p className="mt-4 text-sm text-stone-500">Your bag is empty. Add items from the menu first.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3">
                  <div className="relative h-14 w-14 overflow-hidden rounded-xl">
                    <Image src={i.imageUrl} alt="" fill className="object-cover" sizes="56px" />
                  </div>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{i.name}</p>
                    {i.kind === "deal" && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Combo deal</p>
                    )}
                    <p className="text-stone-500">
                      {i.quantity} × {pkr(i.price)}
                    </p>
                    {i.instructions ? (
                      <p className="mt-0.5 text-xs text-stone-500">
                        <span className="font-medium text-stone-600">Note:</span> {i.instructions}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 space-y-3 border-t border-orange-100 pt-5 text-sm">
            <div className="flex justify-between">
              <span className="text-stone-500">Subtotal</span>
              <span>{pkr(subtotal)}</span>
            </div>
            {isDelivery && (
              <div className="flex justify-between gap-2">
                <span className="text-stone-500">Delivery ({areaName})</span>
                <span className="text-right">
                  {qualifiesFreeDelivery ? (
                    <span className="text-emerald-600">
                      Free
                      {freeAbove != null && (
                        <span className="block text-[10px] font-normal text-emerald-700/80">
                          Orders above {pkr(freeAbove)}
                        </span>
                      )}
                    </span>
                  ) : (
                    pkr(effectiveDelivery)
                  )}
                </span>
              </div>
            )}
            {quoted.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">
                  {settings?.taxLabel || "Tax"}
                  {settings?.taxIncluded ? " (included)" : ""}
                </span>
                <span>{pkr(quoted.tax)}</span>
              </div>
            )}
            {quoted.service > 0 && (
              <div className="flex justify-between">
                <span className="text-stone-500">
                  {settings?.serviceChargeLabel || "Service charge"}
                  {settings?.serviceIncluded ? " (included)" : ""}
                </span>
                <span>{pkr(quoted.service)}</span>
              </div>
            )}
            <p className="text-xs text-stone-500">
              {isDelivery
                ? cashOn
                  ? "Pay cash on delivery."
                  : "Cash on delivery is turned off."
                : cardOn
                  ? "Pay cash or card when you collect."
                  : "Pay when you collect."}
            </p>
            <div className="flex justify-between font-semibold">
              <span>Total</span>
              <span className="text-brand-700">{pkr(grandTotal)}</span>
            </div>
          </div>
        </aside>
      </div>
    </StoreShell>
  );
}
