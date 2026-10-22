export type BranchOpenState = {
  isOpenNow: boolean;
  hoursSource: "store";
  nextOpenAt: string | null;
  nextCloseAt: string | null;
  nextOpenLabel: string | null;
  nextCloseLabel: string | null;
};

export type BranchSetupChecklist = {
  staff: boolean;
  openingStock: boolean;
  tables: boolean;
  printers: boolean;
  testOrder: boolean;
  completed: number;
  total: number;
};

export type BranchPerformance = {
  orders: number;
  collected: number;
  avgOrderValue: number;
  latePercent: number;
  avgRating: number | null;
};

export type BranchLive = {
  ordersToday: number;
  collectedToday: number;
  bookedToday: number;
  inProgress: number;
  lateOrders: number;
  openShifts: number;
};

export type BranchCounts = {
  staff: number;
  tables: number;
  printStations: number;
  deliveryAreas: number;
};

export type AdminBranch = {
  id: string;
  name: string;
  code: string;
  address: string;
  addressLine?: string;
  area?: string;
  city?: string;
  latitude?: number | null;
  longitude?: number | null;
  email?: string | null;
  phone: string;
  managerUserId?: string | null;
  managerUser?: { id: string; name: string } | null;
  acceptsOnlineOrders: boolean;
  isActive: boolean;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
  deactivatedAt?: string | null;
  sortOrder: number;
  timezone?: string;
  createdAt?: string;
  open: BranchOpenState;
  counts: BranchCounts;
  live: BranchLive;
  setupChecklist?: BranchSetupChecklist;
  performance?: BranchPerformance;
  performanceDelta?: { orders: number; collected: number; avgOrderValue: number };
};

export type BranchesListResponse = {
  branches: AdminBranch[];
  meta: {
    timezone: string;
    range: string;
    periodFrom?: string;
    periodTo?: string;
    ms: number;
  };
};

export type DeactivationBlocker = {
  code: string;
  label: string;
  count: number;
  href: string;
};

export type DeactivationCheck = {
  canDeactivate: boolean;
  blockers: DeactivationBlocker[];
  staffAssigned: number;
  staffNote: string;
};

export type CopyFromOptions = {
  menuAvailability?: boolean;
  printStations?: boolean;
  tables?: boolean;
  deliveryAreas?: boolean;
  openingHours?: boolean;
};

export type Branch = {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  createdAt?: string;
  acceptsOnlineOrders?: boolean;
  timezone?: string;
  _count?: { orders: number; members: number };
};

export type BranchSelection = string | "all";

export type BranchesListRange = "today" | "7d" | "30d";
