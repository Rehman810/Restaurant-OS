export type DishAvailabilityState = "available" | "soldOut";

export type AdminDishAvailability = {
  state: DishAvailabilityState;
  reason: string | null;
  until: string | null;
  untilKind: string | null;
};

export type AdminDishRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  effectivePrice: number;
  thumbnail: string;
  visibility: "visible" | "hidden";
  availability: AdminDishAvailability;
  optionGroupCount: number;
  tags: string[];
  allergens: string[];
  station: { id: string; name: string; code: string } | null;
  prepMinutes: number | null;
  sku: string | null;
  position: number;
  soldLast30Days: number;
  updatedAt: string;
  archivedAt: string | null;
  marginPercent?: number;
  costKnown?: boolean;
};

export type AdminDishListResponse = {
  rows: AdminDishRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: {
    available: number;
    soldOut: number;
    hidden: number;
    archived: number;
  };
};

export type DishViewMode = "list" | "compact" | "grid";

export type DishStatusFilter = "available" | "soldOut" | "hidden" | "archived";

export type DealScheduleStatus = "active" | "scheduled" | "expired" | "hidden";

export type AdminDealRow = {
  id: string;
  title: string;
  description: string;
  group: string;
  dealPrice: number;
  componentSum: number;
  savings: number;
  priceWarning: boolean;
  thumbnail: string;
  visibility: "visible" | "hidden";
  availability: AdminDishAvailability;
  scheduleStatus: DealScheduleStatus;
  scheduleSummary: string;
  channels: { online: boolean; pos: boolean; dineIn: boolean };
  perOrderLimit: number | null;
  unitsSold: number;
  items: { menuItemId: string; name: string; quantity: number; price: number }[];
  sortOrder: number;
  updatedAt: string;
};

export type AdminDealListResponse = {
  rows: AdminDealRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { active: number; scheduled: number; expired: number; hidden: number };
};

export type DealStatusFilter = "active" | "scheduled" | "expired" | "hidden";

export type CategoryScheduleStatus = "active" | "scheduled" | "hidden";

export type AdminCategoryRow = {
  id: string;
  name: string;
  tagline: string;
  imageUrl: string;
  sortOrder: number;
  isVisible: boolean;
  archivedAt: string | null;
  scheduleDays: number[];
  scheduleStartMinutes: number | null;
  scheduleEndMinutes: number | null;
  dishCount: number;
  scheduleStatus: CategoryScheduleStatus;
  scheduleSummary: string;
};

export type AdminCategoryListResponse = {
  rows: AdminCategoryRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: { active: number; scheduled: number; hidden: number };
};

export type CategoryStatusFilter = "active" | "scheduled" | "hidden";
