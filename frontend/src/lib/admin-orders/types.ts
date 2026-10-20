import type { FulfillmentType, OrderStatus } from "@/lib/types";

export type AdminOrderSource = "online" | "pos";
export type AdminOrdersSort = "newest" | "oldest" | "lateFirst" | "total";
export type AdminPaymentFilter = "paid" | "unpaid" | "cod" | "partial";

export type AdminNextAction = {
  action: "transition" | "cancel";
  targetStatus: OrderStatus;
  label: string;
  primary: boolean;
};

export type AdminOrderRow = {
  id: string;
  number: string;
  shortNumber: string;
  shortDisplay: string;
  type: FulfillmentType;
  source: AdminOrderSource;
  status: OrderStatus;
  nextActions: AdminNextAction[];
  createdAt: string;
  statusChangedAt: string;
  ageSeconds: number;
  isLate: boolean;
  isStale: boolean;
  customer: { name: string; phone: string; phoneMasked?: boolean };
  itemsSummary: {
    lines: { quantity: number; name: string; optionsLabel: string }[];
    extraCount: number;
    totalItems: number;
  };
  table: string | null;
  address: { text: string; area: string | null } | null;
  rider: { id: string; name: string; assignedAt: string | null } | null;
  totals: {
    subtotal: number;
    deliveryCharge: number;
    taxAmount: number;
    discountAmount: number;
    total: number;
  };
  payment: {
    status: "paid" | "partial" | "unpaid" | "cod";
    label: string;
    methods: string[];
    amountDue: number;
    codAmount: number | null;
  } | null;
  possibleDuplicateOf: string | null;
  print: { receiptPrinted: boolean; kotPrinted: boolean; kotPrintCount: number };
  notes: { hasNotes: boolean; hasAllergyHint: boolean };
  isRush: boolean;
};

export type AdminOrderDetail = {
  id: string;
  number: string;
  shortNumber: string;
  shortDisplay: string;
  type: FulfillmentType;
  source: AdminOrderSource;
  status: OrderStatus;
  createdAt: string;
  statusChangedAt: string;
  ageSeconds: number;
  isLate: boolean;
  isStale: boolean;
  nextActions: AdminNextAction[];
  items: {
    id: string;
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    optionsLabel: string;
    instructions: string;
  }[];
  totals: {
    subtotal: number;
    deliveryCharge: number;
    taxAmount: number;
    discountAmount: number;
    serviceAmount: number;
    total: number;
  };
  payment: AdminOrderRow["payment"];
  payments: {
    method: string;
    amount: number;
    tendered: number | null;
    changeGiven: number | null;
    at: string;
  }[] | null;
  customer: {
    name: string;
    phone: string;
    email: string | null;
    previousOrdersCount: number;
    recentOrders: {
      id: string;
      orderNumber: string;
      status: OrderStatus;
      total: number;
      createdAt: string;
    }[];
  };
  table: string | null;
  address: string;
  deliveryArea: string | null;
  rider: { id: string; name: string; phone: string | null } | null;
  notes: string | null;
  timeline: {
    fromStatus: OrderStatus | null;
    toStatus: OrderStatus;
    at: string;
    actor: { id: string; name: string; role: string | null } | null;
    reason: string | null;
  }[];
  print: {
    kotPrintedAt: string | null;
    kotPrintCount: number;
    kotLogs: { at: string; isReprint: boolean }[];
    invoice: { id: string; invoiceNumber: string } | null;
  };
  possibleDuplicateOf: string | null;
  location: {
    ip: string | null;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  } | null;
};

export type AdminBulkResult = {
  results: { id: string; ok: boolean; error?: string }[];
  succeeded: number;
  failed: number;
};

export type AdminOrdersListResponse = {
  rows: AdminOrderRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  summary: {
    statusCounts: Record<string, number>;
    completedCount: number;
    active: number;
    late: number;
    stale: number;
    unpaid: number;
    booked: number | null;
    bookedDefinition: string;
  };
  serverTime: string;
  timezone: string;
};
