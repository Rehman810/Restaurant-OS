import { FulfillmentType, OrderStatus, Role } from "@prisma/client";
import { normalizeBlockEmail, normalizeBlockPhone } from "./blocklist";
import { customerPhoneMatchKey } from "./customer-phone";
import {
  resolveCustomerSegment,
  vipSpendThreshold,
  type CustomerSegment,
} from "./customer-segments";
import { prisma } from "./prisma";

export function customerContactKey(phone: string, email: string | null | undefined) {
  const phoneKey = normalizeBlockPhone(phone);
  if (phoneKey) return `phone:${phoneKey}`;
  const emailKey = normalizeBlockEmail(email);
  if (emailKey) return `email:${emailKey}`;
  return null;
}

export type CustomerDirectoryRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Account creation for registered users; first order date for guests. */
  createdAt: Date;
  isGuest: boolean;
  orderCount: number;
  nonCancelledOrderCount: number;
  totalSpent: number;
  segment: CustomerSegment | null;
  lastOrder: {
    id: string;
    total: number;
    status: OrderStatus;
    createdAt: Date;
    fulfillmentType: FulfillmentType;
  } | null;
};

type MutableRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  isGuest: boolean;
  orderCount: number;
  nonCancelledOrderCount: number;
  totalSpent: number;
  lastOrder: CustomerDirectoryRow["lastOrder"];
};

type GuestAgg = MutableRow;

export type CustomerSort = "spent" | "orders" | "name" | "recent";

type OrderSlice = {
  id: string;
  total: number | { toString(): string };
  status: OrderStatus;
  createdAt: Date;
  fulfillmentType: FulfillmentType;
  customerName?: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
};

function applyOrder(row: MutableRow, order: OrderSlice, opts?: { joinedFromFirstOrder?: boolean }) {
  row.orderCount += 1;
  if (order.status !== OrderStatus.CANCELLED) {
    row.nonCancelledOrderCount += 1;
    row.totalSpent += Number(order.total);
  }
  if (!row.lastOrder || order.createdAt > row.lastOrder.createdAt) {
    row.lastOrder = {
      id: order.id,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
      fulfillmentType: order.fulfillmentType,
    };
  }
  if (opts?.joinedFromFirstOrder && order.createdAt < row.createdAt) {
    row.createdAt = order.createdAt;
  }
}

function registeredRowFromUser(user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
}): MutableRow {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    isGuest: false,
    orderCount: 0,
    nonCancelledOrderCount: 0,
    totalSpent: 0,
    lastOrder: null,
  };
}

function attachSegments(rows: CustomerDirectoryRow[]): CustomerDirectoryRow[] {
  const threshold = vipSpendThreshold(rows.map((r) => r.totalSpent));
  const now = new Date();
  return rows.map((row) => ({
    ...row,
    segment: resolveCustomerSegment({
      orderCount: row.orderCount,
      totalSpent: row.totalSpent,
      lastOrderAt: row.lastOrder?.createdAt ?? null,
      vipSpendThreshold: threshold,
      now,
    }),
  }));
}

export async function buildCustomerDirectory(branchId?: string | null): Promise<CustomerDirectoryRow[]> {
  const branchFilter = branchId ? { branchId } : {};

  const [users, registeredOrders, guestOrders] = await Promise.all([
    prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { customerId: { not: null }, ...branchFilter },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        fulfillmentType: true,
        customerId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { customerId: null, ...branchFilter },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
        fulfillmentType: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const registeredById = new Map<string, MutableRow>();
  const phoneToUserId = new Map<string, string>();
  for (const user of users) {
    registeredById.set(user.id, registeredRowFromUser(user));
    const key = customerPhoneMatchKey(user.phone);
    if (key) phoneToUserId.set(key, user.id);
  }

  for (const order of registeredOrders) {
    if (!order.customerId) continue;
    const row = registeredById.get(order.customerId);
    if (!row) continue;
    applyOrder(row, {
      id: order.id,
      total: Number(order.total),
      status: order.status,
      createdAt: order.createdAt,
      fulfillmentType: order.fulfillmentType,
      customerName: row.name,
      customerPhone: row.phone,
      customerEmail: row.email,
    });
  }

  const guestByKey = new Map<string, GuestAgg>();
  for (const order of guestOrders) {
    const phoneKey = customerPhoneMatchKey(order.customerPhone);
    const linkedUserId = phoneKey ? phoneToUserId.get(phoneKey) : undefined;
    if (linkedUserId) {
      const row = registeredById.get(linkedUserId);
      if (row) {
        applyOrder(row, order, { joinedFromFirstOrder: false });
        continue;
      }
    }

    const key = customerContactKey(order.customerPhone, order.customerEmail);
    if (!key) continue;

    let guest = guestByKey.get(key);
    if (!guest) {
      guest = {
        id: `guest:${key}`,
        name: order.customerName,
        email: order.customerEmail || "",
        phone: order.customerPhone,
        createdAt: order.createdAt,
        isGuest: true,
        orderCount: 0,
        nonCancelledOrderCount: 0,
        totalSpent: 0,
        lastOrder: null,
      };
      guestByKey.set(key, guest);
    }

    applyOrder(guest, order, { joinedFromFirstOrder: true });
    if (order.customerName) guest.name = order.customerName;
    if (order.customerEmail) guest.email = order.customerEmail;
    if (order.customerPhone) guest.phone = order.customerPhone;
  }

  const merged = [...registeredById.values(), ...guestByKey.values()];

  const filtered = branchId
    ? merged.filter((c) => c.orderCount > 0)
    : merged.filter((c) => c.orderCount > 0 || !c.isGuest);

  return attachSegments(filtered as CustomerDirectoryRow[]);
}

export type CustomerSegmentFilter = CustomerSegment | "all";

export function filterCustomers(
  customers: CustomerDirectoryRow[],
  search: string,
  sort: CustomerSort,
  segment: CustomerSegmentFilter = "all"
) {
  let list = [...customers];
  const q = search.trim().toLowerCase();
  if (q) {
    const qDigits = q.replace(/\D/g, "");
    list = list.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.email.toLowerCase().includes(q)) return true;
      if (c.phone && c.phone.includes(q)) return true;
      if (qDigits.length >= 4 && c.phone) {
        const phoneDigits = c.phone.replace(/\D/g, "");
        if (phoneDigits.includes(qDigits)) return true;
      }
      return false;
    });
  }

  if (segment !== "all") {
    list = list.filter((c) => c.segment === segment);
  }

  list.sort((a, b) => {
    if (sort === "spent") return b.totalSpent - a.totalSpent;
    if (sort === "orders") return b.orderCount - a.orderCount;
    if (sort === "name") return a.name.localeCompare(b.name);
    const aJoined = a.createdAt.getTime();
    const bJoined = b.createdAt.getTime();
    return bJoined - aJoined;
  });

  return list;
}

export function paginateCustomers(customers: CustomerDirectoryRow[], limit: number, offset: number) {
  const total = customers.length;
  const page = customers.slice(offset, offset + limit);
  return { customers: page, total, limit, offset };
}

export function customerDirectoryStats(customers: CustomerDirectoryRow[]) {
  const withOrders = customers.filter((c) => c.orderCount > 0);
  const totalRevenue = withOrders.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrders = withOrders.reduce((sum, c) => sum + c.orderCount, 0);
  const nonCancelledOrders = withOrders.reduce((sum, c) => sum + c.nonCancelledOrderCount, 0);
  const repeat = withOrders.filter((c) => c.orderCount > 1).length;
  const topSpender = [...withOrders].sort((a, b) => b.totalSpent - a.totalSpent)[0];
  return {
    count: customers.length,
    totalRevenue,
    totalOrders,
    nonCancelledOrders,
    avgSpend: withOrders.length ? totalRevenue / withOrders.length : 0,
    avgOrderValue: nonCancelledOrders > 0 ? totalRevenue / nonCancelledOrders : 0,
    repeatRate: withOrders.length ? Math.round((repeat / withOrders.length) * 100) : 0,
    topSpenderId: topSpender?.id,
  };
}

export async function listCustomerOrders(
  customerId: string,
  limit: number,
  offset: number,
  branchId?: string | null
) {
  const branchFilter = branchId ? { branchId } : {};

  if (customerId.startsWith("guest:")) {
    const contactKey = customerId.slice("guest:".length);
    const guestOrders = await prisma.order.findMany({
      where: { customerId: null, ...branchFilter },
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        fulfillmentType: true,
        customerPhone: true,
        customerEmail: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const filtered = guestOrders.filter(
      (order) => customerContactKey(order.customerPhone, order.customerEmail) === contactKey
    );
    return {
      orders: filtered.slice(offset, offset + limit).map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: Number(order.total),
        status: order.status,
        createdAt: order.createdAt,
        fulfillmentType: order.fulfillmentType,
      })),
      total: filtered.length,
      limit,
      offset,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, email: true, phone: true },
  });
  if (!user) return null;

  const phoneKey = normalizeBlockPhone(user.phone);
  const emailKey = normalizeBlockEmail(user.email);
  const guestPhoneOr: { customerId: null; customerPhone?: { contains: string } }[] = [];
  if (phoneKey) {
    guestPhoneOr.push({ customerId: null, customerPhone: { contains: phoneKey.slice(-10) } });
  }
  const where = {
    AND: [
      {
        OR: [
          { customerId: user.id },
          ...guestPhoneOr,
          ...(emailKey
            ? [{ customerId: null as null, customerEmail: { equals: emailKey, mode: "insensitive" as const } }]
            : []),
        ],
      },
      branchFilter,
    ],
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        createdAt: true,
        fulfillmentType: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.order.count({ where }),
  ]);

  return {
    orders: orders.map((order) => ({
      ...order,
      total: Number(order.total),
    })),
    total,
    limit,
    offset,
  };
}
