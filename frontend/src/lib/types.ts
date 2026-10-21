import { canTransition, flowFor, isTerminalStatus, nextStatus as nextStatusInFlow } from "./order-machine";
import type { Fulfillment } from "./order-machine";

export type Role = "CUSTOMER" | "ADMIN" | "MANAGER" | "WAITER" | "RIDER" | "CHEF" | "CASHIER";

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  totpEnabled?: boolean;
  loyaltyPoints?: number;
};

export type MenuItemOption = {
  id: string;
  name: string;
  price: string | number;
  discountPrice?: string | number | null;
  sortOrder: number;
};

export type MenuItemOptionGroup = {
  id: string;
  name: string;
  required: boolean;
  sortOrder: number;
  options: MenuItemOption[];
};

export type MenuItemAddon = {
  id: string;
  name: string;
  price: string | number;
  sortOrder: number;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: string | number;
  discountPrice?: string | number | null;
  effectivePrice?: number;
  category: string;
  imageUrl: string;
  isAvailable: boolean;
  optionGroups?: MenuItemOptionGroup[];
  addons?: MenuItemAddon[];
  printStationId?: string | null;
  printStation?: { id: string; name: string; code: string } | null;
  createdAt?: string;
  updatedAt?: string;
};

export type Testimonial = {
  id: string;
  name: string;
  area: string;
  text: string;
  rating: number;
  isPublished: boolean;
  sortOrder: number;
};

export type StoreHighlights = {
  show: boolean;
  rating: number | null;
  orderCount: number | null;
  areaCount: number;
};

export type StoreSettings = {
  id: string;
  storeName: string;
  storeTagline: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  accentColor?: string;
  city?: string;
  timezone?: string;
  currencyCode?: string;
  currencySymbol?: string;
  footerText?: string;
  poweredByText?: string;
  poweredByUrl?: string;
  showPoweredBy?: boolean;
  showLiveStats?: boolean;
  showReviewsSection?: boolean;
  inventoryAutoHideMenu?: boolean;
  inventoryAllowNegative?: boolean;
  inventoryDeductAtPreparing?: boolean;
  maxCashierDiscountPercent?: number | string;
  requireApprovalForVoid?: boolean;
  requireApprovalForRefund?: boolean;
  requireApprovalForPriceOverride?: boolean;
  voidReasonOptions?: string[];
  discountReasonOptions?: string[];
  refundReasonOptions?: string[];
  shiftVarianceTolerance?: number | string;
  riderCashStaleHours?: number;
  lateConfirmMinutes?: number;
  latePrepMinutes?: number;
  lateDeliveryMinutes?: number;
  ordersStaleHours?: number;
  duplicateOrderWindowMinutes?: number;
  trackingCompletedWindowHours?: number;
  shiftOpenWarningHours?: number;
  lowRatingThreshold?: number;
  twoFaReminderDays?: number;
  weekStartDay?: number;
  analyticsInsightMinDays?: number;
  analyticsInsightMinOrders?: number;
  analyticsLowMarginPercent?: number;
  analyticsSlowMoverDays?: number;
  analyticsEmailEnabled?: boolean;
  analyticsEmailFrequency?: string;
  analyticsEmailRecipients?: string;
  analyticsEmailSendHour?: number;
  autoPrintKitchenTickets?: boolean;
  offlinePosEnabled?: boolean;
  offlineClockSkewThresholdMinutes?: number;
  loyaltyEarnPer100?: number | string;
  loyaltyRedeemPerPoint?: number | string;
  loyaltyMaxRedeemPercent?: number | string;
  phone: string;
  whatsapp: string;
  address: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  minimumOrder: string | number;
  freeDeliveryAbove?: string | number | null;
  deliveryEstimateMin: number;
  pickupEstimateMin: number;
  openHour: number;
  openMinute: number;
  closeHour: number;
  closeMinute: number;
  closedMessage: string;
  forceClosed: boolean;
  autoConfirmOrders: boolean;
  autoAssignRiders: boolean;
  emailNotifyAdmin: boolean;
  emailNotifyManager: boolean;
  emailNotifyChef: boolean;
  emailNotifyCashier: boolean;
  emailNotifyWaiter: boolean;
  emailNotifyRider: boolean;
  emailNotifyCustomer: boolean;
  facebookUrl: string;
  instagramUrl: string;
  tiktokUrl: string;
  youtubeUrl: string;
  googlePlaceId?: string;
  weeklySchedule?: unknown;
  taxPercent?: string | number;
  taxLabel?: string;
  taxIncluded?: boolean;
  serviceChargePercent?: string | number;
  serviceChargeLabel?: string;
  serviceIncluded?: boolean;
  acceptCash?: boolean;
  acceptCard?: boolean;
  taxNumber?: string;
  taxEnabled?: boolean;
  taxLegalName?: string;
  taxBusinessAddress?: string;
  taxStrn?: string;
  taxRatesByFulfillment?: Record<string, number>;
  taxRatesByPayment?: Record<string, number>;
  taxFiscalYearEnabled?: boolean;
  taxRoundingRule?: string;
  pricesIncludeTax?: boolean;
  foodCostTargetPercent?: string | number;
  foodCostHighPercent?: string | number;
  suggestedPriceRoundingStep?: number;
  suspiciousLowCostFraction?: string | number;
  ingredientPriceChangeAlertPercent?: string | number;
  storefrontPushEnabled?: boolean;
  receiptFooter?: string;
  confirmSlaMinutes?: number;
  deliverySlaMinutes?: number;
};

export type GoogleReview = {
  name: string;
  text: string;
  rating: number;
  timeAgo: string;
  photoUrl?: string;
};

export type GoogleReviewsPayload = {
  rating: number;
  total: number;
  url?: string;
  reviews: GoogleReview[];
  source: "google" | "fallback";
};

export type PromoBanner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  sortOrder: number;
  isActive: boolean;
};

export type PublicStore = {
  settings: StoreSettings;
  banners: PromoBanner[];
  testimonials?: Testimonial[];
  areaCount?: number;
  highlights?: StoreHighlights;
  isOpen: boolean;
  hoursLabel: string;
  closedMessage: string;
};

export type Category = {
  id: string;
  name: string;
  tagline?: string;
  imageUrl?: string;
  sortOrder: number;
  createdAt: string;
};

export type DealItem = {
  id: string;
  menuItemId: string;
  quantity: number;
  menuItem: Pick<MenuItem, "id" | "name" | "price" | "imageUrl" | "category">;
};

export type Deal = {
  id: string;
  title: string;
  description: string;
  category: string;
  dealPrice: string | number;
  imageUrl: string;
  isActive: boolean;
  createdAt: string;
  items: DealItem[];
};

export type OrderItem = {
  id: string;
  menuItemId: string;
  quantity: number;
  priceAtOrder: string | number;
  nameAtOrder: string;
  optionsLabel?: string;
  instructions?: string;
  printStationId?: string | null;
  menuItem?: { printStationId?: string | null; isAvailable?: boolean; name?: string } | null;
  kitchenDoneAt?: string | null;
};

export type FulfillmentType = "DELIVERY" | "PICKUP" | "DINE_IN";

export type OrderSource = "ONLINE" | "POS";
export type PaymentMethod = "CASH" | "CARD";

export type DeliveryArea = {
  id: string;
  name: string;
  deliveryCharge: string | number;
  isDelivering: boolean;
  sortOrder: number;
};

export type OrderStatus =
  | "PENDING_CONFIRMATION"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "COLLECTED"
  | "SERVED"
  | "CANCELLED";

export type Order = {
  id: string;
  orderNumber: string;
  customerId?: string | null;
  guestAccessToken?: string;
  riderId?: string | null;
  status: OrderStatus;
  orderSource?: OrderSource;
  fulfillmentType?: FulfillmentType;
  paymentMethod?: PaymentMethod | null;
  paymentStatus?: string | null;
  tableNumber?: string | null;
  diningTable?: { id: string; label: string } | null;
  deliveryAreaId?: string | null;
  deliveryArea?: { id: string; name: string; deliveryCharge?: string | number } | null;
  subtotal?: string | number;
  deliveryCharge?: string | number;
  taxAmount?: string | number;
  taxableAmount?: string | number | null;
  taxRatePercentSnap?: string | number | null;
  taxInclusiveSnap?: boolean | null;
  serviceAmount?: string | number;
  discountAmount?: string | number;
  discountPercent?: string | number | null;
  adjustmentReasonCode?: string | null;
  adjustmentReasonNote?: string | null;
  voidReasonCode?: string | null;
  voidReasonNote?: string | null;
  refundAmount?: string | number | null;
  refundReasonCode?: string | null;
  refundReasonNote?: string | null;
  adjustmentRequestedBy?: { id: string; name: string } | null;
  adjustmentApprovedBy?: { id: string; name: string } | null;
  voidApprovedBy?: { id: string; name: string } | null;
  refundApprovedBy?: { id: string; name: string } | null;
  total: string | number;
  deliveryAddress: string;
  notes?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  customerIp?: string | null;
  customerLatitude?: string | number | null;
  customerLongitude?: string | number | null;
  customerLocationAccuracy?: string | number | null;
  createdAt: string;
  readyAt?: string | null;
  promisedAt?: string | null;
  isRush?: boolean;
  kotPrintedAt?: string | null;
  kotPrintCount?: number;
  items: OrderItem[];
  rider?: { id: string; name: string; phone?: string | null } | null;
  invoice?: { id: string; invoiceNumber: string } | null;
  feedback?: { id: string; rating: number; comment: string } | null;
  offlineLabel?: string | null;
  offlineDeviceLabel?: string | null;
  offlineClientCreatedAt?: string | null;
  needsReview?: boolean;
  needsReviewReason?: string | null;
};

export const CATEGORIES = [
  "Starters",
  "Burgers & Sandwiches",
  "Pizza & Pasta",
  "Biryani & Rice",
  "BBQ & Broast",
  "Karahi & Curries",
  "Sides",
  "Beverages",
  "Desserts",
] as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_CONFIRMATION: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  COLLECTED: "Collected",
  SERVED: "Served",
  CANCELLED: "Cancelled",
};

export function orderStatusLabel(status: OrderStatus, fulfillment?: FulfillmentType | null) {
  const f = fulfillment || "DELIVERY";
  if (status === "READY" && f === "DINE_IN") return "Ready to serve";
  if (status === "READY" && f === "PICKUP") return "Ready for pickup";
  if (status === "READY" && f === "DELIVERY") return "Ready for rider";
  return STATUS_LABEL[status];
}

/** Customer timeline steps — matches backend order machine per fulfillment type. */
export function statusFlowFor(fulfillment?: FulfillmentType | null): OrderStatus[] {
  return flowFor((fulfillment || "DELIVERY") as Fulfillment) as OrderStatus[];
}

/** @deprecated Prefer statusFlowFor(fulfillment) — delivery-only default. */
export const STATUS_FLOW: OrderStatus[] = statusFlowFor("DELIVERY");

/** Admin kanban columns (orders land in the column matching their status). */
export const ADMIN_KANBAN_COLUMNS: OrderStatus[] = [
  "CONFIRMED",
  "PREPARING",
  "READY",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "COLLECTED",
  "SERVED",
];

export function nextOrderStatus(
  current: OrderStatus,
  fulfillment?: FulfillmentType | null
): OrderStatus | null {
  const next = nextStatusInFlow(current, (fulfillment || "DELIVERY") as Fulfillment);
  return next as OrderStatus | null;
}

export function isOrderTerminal(status: OrderStatus) {
  return isTerminalStatus(status as import("./order-machine").Status);
}

/** Kanban / pipeline: one legal step forward for this fulfillment type. */
export function canMoveForward(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment?: FulfillmentType | null
): boolean {
  return from !== to && canTransition(from, to, (fulfillment || "DELIVERY") as Fulfillment);
}

export function isBackwardMove(
  from: OrderStatus,
  to: OrderStatus,
  fulfillment?: FulfillmentType | null
): boolean {
  const flow = statusFlowFor(fulfillment);
  const fromIdx = flow.indexOf(from);
  const toIdx = flow.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) return false;
  return toIdx < fromIdx;
}

export function forwardStatusOptions(current: OrderStatus, fulfillment?: FulfillmentType | null) {
  const flow = statusFlowFor(fulfillment);
  const idx = flow.indexOf(current);
  if (idx < 0) return flow;
  return flow.slice(idx);
}
