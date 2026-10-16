import { Router } from "express";
import crypto from "crypto";
import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { findOrderBlock } from "../lib/blocklist";
import { canAccessOrder, phonesMatch, stripGuestToken } from "../lib/order-access";
import { ADMIN_LIKE, ORDER_OPS } from "../lib/roles";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { trackLimiter } from "../middleware/security";
import {
  sendOrderCancelledEmail,
  sendOrderConfirmedEmail,
  sendOrderDeliveredEmail,
  sendOrderOnTheWayEmail,
  sendOrderPlacedEmail,
  sendOrderPreparingEmail,
  sendNewOrderStaffEmail,
  sendRiderAssignedEmail,
} from "../lib/email";
import { formatMoney } from "../lib/money";
import { emitOrderChange } from "../lib/realtime";
import { sendNewOrderStaffWhatsApp, sendOrderReceivedWhatsApp } from "../lib/whatsapp";
import { generateInvoicePdf } from "../lib/invoice";
import { clientIp, parseCoord } from "../lib/client-ip";
import { deliveryNeedsRider, pickLeastBusyRider } from "../lib/rider-assign";
import { staffOrderAlertEmails, storeNameFrom } from "../lib/branding";
import { getStoreSettings } from "../lib/settings-data";
import { branchScopeError, getDefaultBranchId, resolveBranchScope } from "../lib/branch-scope";
import { buildOrderLines, nextOrderNumber } from "../lib/order-lines";
import {
  canTransitionStatus,
  chefNextStatus,
} from "../lib/order-status";
import { signOrderViewToken } from "../lib/order-access";
import { effectiveItemPrice, isStoreOpen, publicClosedMessage } from "../lib/store-settings";
import { quoteCharges } from "../lib/charges";
import { cleanText } from "../lib/text";

function zonedDayStart(isoDate: string, timeZone: string) {
  try {
    const utcMidnight = new Date(`${isoDate}T00:00:00Z`);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(utcMidnight);
    const pick = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    const hour = pick("hour") === 24 ? 0 : pick("hour");
    const zonedAsUtc = Date.UTC(pick("year"), pick("month") - 1, pick("day"), hour, pick("minute"), pick("second"));
    return new Date(utcMidnight.getTime() - (zonedAsUtc - utcMidnight.getTime()));
  } catch {
    return new Date(`${isoDate}T00:00:00+05:00`);
  }
}

export const ordersRouter = Router();

const include = {
  items: true,
  rider: { select: { id: true, name: true, phone: true } },
  invoice: true,
  deliveryArea: { select: { id: true, name: true, deliveryCharge: true } },
};

function normalizePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "").trim();
  return cleaned.length >= 10 ? cleaned : "";
}

function normalizeEmail(email: unknown) {
  const value = String(email || "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

ordersRouter.post("/", optionalAuth, async (req, res) => {
  const storeSettings = await getStoreSettings();
  if (!isStoreOpen(storeSettings)) {
    return res.status(400).json({ error: publicClosedMessage(storeSettings) });
  }

  const pickupAddress = `${storeNameFrom(storeSettings)} — ${storeSettings.address}`;

  const {
    items,
    deals,
    deliveryAddress,
    notes,
    customerName,
    customerPhone,
    customerEmail,
    fulfillmentType,
    deliveryAreaId,
    customerLatitude,
    customerLongitude,
    customerLocationAccuracy,
    branchId: branchIdBody,
  } = req.body as {
    items?: {
      menuItemId: string;
      quantity: number;
      sizeId?: string;
      optionIds?: string[];
      addonIds?: string[];
      instructions?: string;
    }[];
    deals?: { dealId: string; quantity: number }[];
    deliveryAddress?: string;
    notes?: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    fulfillmentType?: FulfillmentType;
    deliveryAreaId?: string;
    customerLatitude?: number;
    customerLongitude?: number;
    customerLocationAccuracy?: number;
    branchId?: string;
  };
  const cartItems = items ?? [];
  const cartDeals = deals ?? [];
  const phone = normalizePhone(String(customerPhone || ""));
  const email = normalizeEmail(customerEmail);
  const trimmedName = cleanText(customerName, 80);
  const initialStatus = storeSettings.autoConfirmOrders
    ? OrderStatus.CONFIRMED
    : OrderStatus.PENDING_CONFIRMATION;
  const mode: FulfillmentType =
    fulfillmentType === FulfillmentType.PICKUP ? FulfillmentType.PICKUP : FulfillmentType.DELIVERY;

  let resolvedBranchId = await getDefaultBranchId();
  if (branchIdBody) {
    const branch = await prisma.branch.findFirst({
      where: { id: String(branchIdBody), isActive: true },
      select: { id: true, name: true, address: true },
    });
    if (!branch) {
      return res.status(400).json({ error: "Selected branch is not available." });
    }
    resolvedBranchId = branch.id;
  }

  let pickupLine = pickupAddress;
  if (mode === FulfillmentType.PICKUP) {
    const branch = await prisma.branch.findUnique({
      where: { id: resolvedBranchId },
      select: { name: true, address: true },
    });
    if (branch) {
      const addr = branch.address.trim() || storeSettings.address;
      pickupLine = `${branch.name} — ${addr}`;
    }
  }

  const trimmedAddress =
    mode === FulfillmentType.PICKUP ? pickupLine : cleanText(deliveryAddress, 300);
  const safeNotes = notes ? cleanText(notes, 400) : "";

  if (!cartItems.length && !cartDeals.length) {
    return res.status(400).json({ error: "Your bag is empty. Add items before placing an order." });
  }
  if (!trimmedName) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!phone) {
    return res.status(400).json({ error: "Enter a valid phone number with at least 10 digits." });
  }

  const blocked = await findOrderBlock(email, phone);
  if (blocked) {
    return res.status(403).json({
      error: "Ordering is not available for this contact. Please call the restaurant if you need help.",
    });
  }

  if (mode === FulfillmentType.DELIVERY && !trimmedAddress) {
    return res.status(400).json({ error: "Delivery address is required." });
  }
  if (mode === FulfillmentType.DELIVERY && !deliveryAreaId) {
    return res.status(400).json({ error: "Please select a delivery area." });
  }

  let deliveryCharge = 0;
  let areaId: string | null = null;
  if (mode === FulfillmentType.DELIVERY) {
    const area = await prisma.deliveryArea.findUnique({ where: { id: deliveryAreaId } });
    if (!area || !area.isDelivering) {
      return res.status(400).json({ error: "Selected area is not available for delivery." });
    }
    deliveryCharge = Number(area.deliveryCharge);
    areaId = area.id;
  }

  const user = req.user;
  const isRegisteredCustomer = user?.role === Role.CUSTOMER;
  const guestAccessToken = isRegisteredCustomer ? null : crypto.randomBytes(32).toString("base64url");

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: cartItems.map((i) => i.menuItemId) } },
    include: {
      sizes: true,
      addons: true,
      optionGroups: { include: { options: true } },
    },
  });
  const byId = new Map(menuItems.map((m) => [m.id, m]));

  const lines: {
    menuItemId: string;
    quantity: number;
    priceAtOrder: number;
    nameAtOrder: string;
    optionsLabel: string;
    instructions: string;
  }[] = [];
  let subtotal = 0;

  for (const row of cartItems) {
    const menu = byId.get(row.menuItemId);
    if (!menu || !menu.isAvailable) {
      return res.status(400).json({ error: `Item unavailable: ${row.menuItemId}` });
    }
    const qty = Math.max(1, Number(row.quantity) || 1);
    const labels: string[] = [];
    const allOptions = [
      ...menu.optionGroups.flatMap((g) => g.options),
      ...menu.sizes.map((s) => ({ ...s, discountPrice: null as null })),
    ];
    const optionIds = row.optionIds?.length
      ? row.optionIds
      : row.sizeId
        ? [row.sizeId]
        : [];

    const hasGroups = menu.optionGroups.length > 0 || menu.sizes.length > 0;
    let unitPrice = effectiveItemPrice(menu);

    if (hasGroups && optionIds.length) {
      unitPrice = 0;
      for (const optId of optionIds) {
        const opt = allOptions.find((o) => o.id === optId);
        if (!opt) return res.status(400).json({ error: "Invalid option selected." });
        const optPrice =
          opt.discountPrice != null ? Number(opt.discountPrice) : Number(opt.price);
        unitPrice += optPrice;
        labels.push(opt.name);
      }
    } else if (hasGroups) {
      const required = menu.optionGroups.filter((g) => g.required);
      if (required.length > 0) {
        return res.status(400).json({ error: `Please select options for ${menu.name}.` });
      }
    }

    const addonIds = row.addonIds ?? [];
    for (const addonId of addonIds) {
      const addon = menu.addons.find((a) => a.id === addonId);
      if (!addon) return res.status(400).json({ error: "Invalid add-on selected." });
      unitPrice += Number(addon.price);
      labels.push(addon.name);
    }

    const instructions = String(row.instructions || "").trim().slice(0, 500);

    subtotal += unitPrice * qty;
    lines.push({
      menuItemId: menu.id,
      quantity: qty,
      priceAtOrder: unitPrice,
      nameAtOrder: menu.name,
      optionsLabel: labels.join(", "),
      instructions,
    });
  }

  for (const row of cartDeals) {
    const deal = await prisma.deal.findUnique({
      where: { id: row.dealId },
      include: {
        items: { include: { menuItem: true } },
      },
    });
    if (!deal || !deal.isActive) {
      return res.status(400).json({ error: "Deal unavailable." });
    }
    const dealQty = Math.max(1, Number(row.quantity) || 1);
    const dealPrice = Number(deal.dealPrice) * dealQty;
    subtotal += dealPrice;

    const regular = deal.items.reduce(
      (sum, item) => sum + Number(item.menuItem.price) * item.quantity,
      0
    );

    for (const item of deal.items) {
      if (!item.menuItem.isAvailable) {
        return res.status(400).json({ error: `${item.menuItem.name} in this deal is unavailable.` });
      }
      const share =
        regular > 0
          ? (Number(item.menuItem.price) * item.quantity) / regular
          : 1 / deal.items.length;
      const lineTotal = dealPrice * share;
      const lineQty = item.quantity * dealQty;
      lines.push({
        menuItemId: item.menuItemId,
        quantity: lineQty,
        priceAtOrder: lineTotal / lineQty,
        nameAtOrder: `${deal.title} · ${item.menuItem.name}`,
        optionsLabel: "",
        instructions: "",
      });
    }
  }

  const minimumOrder = Number(storeSettings.minimumOrder);
  if (subtotal < minimumOrder) {
    return res.status(400).json({
      error: `Minimum order is ${formatMoney(minimumOrder, storeSettings)}. Add more items to continue.`,
    });
  }

  if (
    mode === FulfillmentType.DELIVERY &&
    storeSettings.freeDeliveryAbove != null &&
    subtotal >= Number(storeSettings.freeDeliveryAbove)
  ) {
    deliveryCharge = 0;
  }

  if (mode === FulfillmentType.DELIVERY && !storeSettings.acceptCash) {
    return res.status(400).json({ error: "Cash on delivery is not available right now." });
  }

  const quoted = quoteCharges(subtotal, deliveryCharge, storeSettings);

  const lat = parseCoord(customerLatitude, -90, 90);
  const lng = parseCoord(customerLongitude, -180, 180);
  const locAccuracy = parseCoord(customerLocationAccuracy, 0, 50_000);
  const ip = clientIp(req);

  const order = await prisma.order.create({
    data: {
      orderNumber: await nextOrderNumber(),
      branchId: resolvedBranchId,
      customerId: isRegisteredCustomer ? user!.id : null,
      guestAccessToken,
      fulfillmentType: mode,
      deliveryAreaId: areaId,
      subtotal,
      deliveryCharge,
      taxAmount: quoted.tax,
      serviceAmount: quoted.service,
      total: quoted.total,
      deliveryAddress: trimmedAddress,
      notes: safeNotes || null,
      customerName: trimmedName,
      customerPhone: phone,
      customerEmail: email,
      customerIp: ip,
      customerLatitude: lat,
      customerLongitude: lng,
      customerLocationAccuracy: locAccuracy,
      status: initialStatus,
      items: { create: lines },
    },
    include,
  });

  void sendOrderPlacedEmail(order, storeSettings.autoConfirmOrders);
  void sendOrderReceivedWhatsApp(order, storeSettings.autoConfirmOrders);
  void sendNewOrderStaffWhatsApp(order, storeSettings.whatsapp);
  const alertEmails = await staffOrderAlertEmails(storeSettings);
  void sendNewOrderStaffEmail(order, alertEmails);
  emitOrderChange("order:created", order);

  const safeOrder = stripGuestToken(order);
  if (guestAccessToken) {
    return res.status(201).json({ ...safeOrder, guestAccessToken });
  }
  res.status(201).json(safeOrder);
});

ordersRouter.get("/mine", requireAuth, async (req, res) => {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 10));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const where = { customerId: req.user!.id };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ orders, total, limit, offset });
});

const BOARD_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_CONFIRMATION,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

ordersRouter.get("/board", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const days = Math.min(14, Math.max(1, Number(req.query.days) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const statusParam = String(req.query.statuses || "").trim();
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim())
        .filter((s): s is OrderStatus => Object.values(OrderStatus).includes(s as OrderStatus))
    : BOARD_STATUSES;

  const orders = await prisma.order.findMany({
    where: {
      ...scope.where,
      status: { in: statuses },
      createdAt: { gte: since },
    },
    include: { ...include, customer: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  res.json({ orders });
});

ordersRouter.get("/", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  let scope;
  try {
    scope = await resolveBranchScope(req);
  } catch (err) {
    return branchScopeError(res, err);
  }

  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 20));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const status = req.query.status as OrderStatus | undefined;
  const search = String(req.query.search || "").trim();
  const from = String(req.query.from || "").trim();
  const to = String(req.query.to || "").trim();

  const settings = await getStoreSettings();
  const timeZone = settings.timezone || "Asia/Karachi";
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) createdAt.gte = zonedDayStart(from, timeZone);
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    createdAt.lt = new Date(zonedDayStart(to, timeZone).getTime() + 24 * 60 * 60 * 1000);
  }

  const searchWhere = search
    ? {
        OR: [
          { orderNumber: { contains: search, mode: "insensitive" as const } },
          { customerName: { contains: search, mode: "insensitive" as const } },
          { customerPhone: { contains: search } },
          { deliveryAddress: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const rangedWhere = {
    ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
    ...searchWhere,
  };
  const where = {
    ...scope.where,
    ...rangedWhere,
    ...(status && Object.values(OrderStatus).includes(status) ? { status } : {}),
  };

  const [orders, total, grouped, revenue] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { ...include, customer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.order.count({ where }),
    prisma.order.groupBy({
      by: ["status"],
      where: { ...scope.where, ...rangedWhere },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where,
      _sum: { total: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of grouped) statusCounts[row.status] = row._count._all;

  res.json({
    orders,
    total,
    limit,
    offset,
    statusCounts,
    filteredTotal: Number(revenue._sum.total ?? 0),
  });
});

ordersRouter.post("/track", trackLimiter, async (req, res) => {
  const { orderNumber, phone } = req.body as { orderNumber?: string; phone?: string };
  const num = String(orderNumber || "").trim().toUpperCase();
  const phoneInput = String(phone || "").trim();
  if (!num || !phoneInput) {
    return res.status(400).json({ error: "Order number and phone are required." });
  }

  const order = await prisma.order.findFirst({
    where: { orderNumber: num },
    include,
  });
  if (!order) {
    return res.status(404).json({ error: "No order found with that number." });
  }
  if (!phonesMatch(order.customerPhone, phoneInput)) {
    return res.status(403).json({ error: "Phone number does not match this order." });
  }

  res.json({ ...stripGuestToken(order), accessToken: signOrderViewToken(order.id) });
});

ordersRouter.get("/:id", optionalAuth, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { ...include, customer: { select: { id: true, name: true, email: true } } },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!canAccessOrder(order, req.user, token)) {
    return res.status(403).json({ error: "You do not have access to this order." });
  }
  res.json(stripGuestToken(order));
});

ordersRouter.patch("/:id/cancel", optionalAuth, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  const existing = await prisma.order.findUnique({ where: { id: req.params.id }, include });
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (!canAccessOrder(existing, req.user, token)) {
    return res.status(403).json({ error: "You do not have access to this order." });
  }
  if (!canTransitionStatus(existing.status, OrderStatus.CANCELLED, existing.fulfillmentType)) {
    return res.status(400).json({ error: "This order can no longer be cancelled." });
  }
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
  if (!reason) {
    return res.status(400).json({ error: "A reason is required to cancel an order." });
  }

  const order = await prisma.order.update({
    where: { id: existing.id },
    data: {
      status: OrderStatus.CANCELLED,
      events: {
        create: {
          fromStatus: existing.status,
          toStatus: OrderStatus.CANCELLED,
          actorId: req.user?.id,
          actorRole: req.user?.role,
          reason,
        },
      },
    },
    include,
  });
  void sendOrderCancelledEmail(order);
  emitOrderChange("order:updated", order);
  res.json(stripGuestToken(order));
});

ordersRouter.patch("/:id/confirm", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const existing = await prisma.order.findUnique({ where: { id: req.params.id }, include });
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (existing.status !== OrderStatus.PENDING_CONFIRMATION) {
    return res.status(400).json({ error: "Only unconfirmed orders can be confirmed." });
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status: OrderStatus.CONFIRMED,
      events: {
        create: {
          fromStatus: existing.status,
          toStatus: OrderStatus.CONFIRMED,
          actorId: req.user!.id,
          actorRole: req.user!.role,
        },
      },
    },
    include,
  });
  void sendOrderConfirmedEmail(order);
  emitOrderChange("order:updated", order);
  res.json(order);
});

ordersRouter.patch("/:id/status", requireAuth, requireRole(...ORDER_OPS), async (req, res) => {
  const status = req.body.status as OrderStatus;
  const reason = typeof req.body.reason === "string" ? req.body.reason.trim() : "";
  if (!Object.values(OrderStatus).includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  if (status === OrderStatus.CANCELLED && !reason) {
    return res.status(400).json({ error: "A reason is required to cancel an order." });
  }
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Order not found." });

  if (req.user!.role === Role.CHEF) {
    const next = chefNextStatus(existing.status, existing.fulfillmentType);
    if (!next || status !== next) {
      return res.status(403).json({ error: "Chefs can only advance orders one kitchen step at a time." });
    }
  } else if (req.user!.role === Role.ADMIN || req.user!.role === Role.CASHIER) {
    if (!canTransitionStatus(existing.status, status, existing.fulfillmentType)) {
      return res.status(400).json({
        error: `Cannot change status from ${existing.status} to ${status}.`,
      });
    }
  }

  const storeSettings = await getStoreSettings();
  let riderId = existing.riderId;
  const needsRider = deliveryNeedsRider(existing.fulfillmentType);

  if (
    needsRider &&
    (status === OrderStatus.OUT_FOR_DELIVERY || status === OrderStatus.DELIVERED) &&
    !riderId
  ) {
    if (storeSettings.autoAssignRiders && status === OrderStatus.OUT_FOR_DELIVERY) {
      riderId = await pickLeastBusyRider();
    }
    if (!riderId) {
      const error =
        status === OrderStatus.OUT_FOR_DELIVERY
          ? storeSettings.autoAssignRiders
            ? "No riders available. Add a rider account first."
            : "Assign a rider before sending this order out for delivery."
          : "Assign a rider before marking this order delivered.";
      return res.status(400).json({ error });
    }
  }

  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: {
      status,
      ...(riderId && !existing.riderId ? { riderId } : {}),
      events: {
        create: {
          fromStatus: existing.status,
          toStatus: status,
          actorId: req.user!.id,
          actorRole: req.user!.role,
          reason: reason || null,
        },
      },
    },
    include,
  });

  if (
    existing.status === OrderStatus.PENDING_CONFIRMATION &&
    status === OrderStatus.CONFIRMED
  ) {
    void sendOrderConfirmedEmail(order);
  }
  if (status === OrderStatus.PREPARING && existing.status !== OrderStatus.PREPARING) {
    void sendOrderPreparingEmail(order);
    const { deductInventoryForOrder } = await import("../lib/inventory/stock");
    void deductInventoryForOrder(order.id, req.user!.id).catch(() => null);
  }
  if (status === OrderStatus.OUT_FOR_DELIVERY && existing.status !== OrderStatus.OUT_FOR_DELIVERY) {
    void sendOrderOnTheWayEmail(order);
    if (riderId && riderId !== existing.riderId) {
      const rider = await prisma.user.findUnique({ where: { id: riderId } });
      if (rider) void sendRiderAssignedEmail(rider.email, rider.name, order);
    }
  }
  if (status === OrderStatus.CANCELLED && existing.status !== OrderStatus.CANCELLED) {
    void sendOrderCancelledEmail(order);
    const { reverseInventoryForOrder } = await import("../lib/inventory/stock");
    void reverseInventoryForOrder(order.id, req.user!.id).catch(() => null);
  }
  if (status === OrderStatus.DELIVERED) {
    await generateInvoicePdf(order.id);
    void sendOrderDeliveredEmail(order);
  }

  emitOrderChange("order:updated", order);

  const fresh = await prisma.order.findUnique({ where: { id: order.id }, include });
  res.json(fresh);
});

ordersRouter.patch("/:id/assign", requireAuth, requireRole(...ADMIN_LIKE), async (req, res) => {
  const { riderId } = req.body as { riderId?: string };
  if (!riderId) return res.status(400).json({ error: "riderId required" });
  const rider = await prisma.user.findFirst({ where: { id: riderId, role: Role.RIDER, isActive: true } });
  if (!rider) return res.status(400).json({ error: "Rider not found" });
  const existing = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Order not found." });
  if (existing.status === OrderStatus.PENDING_CONFIRMATION) {
    return res.status(400).json({ error: "Confirm the order before assigning a rider." });
  }
  const order = await prisma.order.update({
    where: { id: req.params.id },
    data: { riderId, status: OrderStatus.OUT_FOR_DELIVERY },
    include,
  });
  if (existing.status !== OrderStatus.OUT_FOR_DELIVERY) {
    void sendOrderOnTheWayEmail(order);
  }
  void sendRiderAssignedEmail(rider.email, rider.name, order);
  emitOrderChange("order:updated", order);
  res.json(order);
});
