import { Role } from "@/lib/types";

export type StaffStatus = "active" | "inactive";

export type StaffListRow = {
  id: string;
  displayName?: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  branches?: string[];
  branchIds?: string[];
  status?: StaffStatus;
  isActive: boolean;
  twoFaEnabled?: boolean;
  totpEnabled: boolean;
  twoFaCompliant?: boolean;
  twoFaRequired?: boolean;
  twoFaGraceEndsAt?: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
  isOwner?: boolean;
  accessSummary?: string;
  isTest?: boolean;
};

export type StaffTileCounts = {
  admins: number;
  managers: number;
  cashiers: number;
  chefs: number;
  riders: number;
  waiters: number;
  inactive: number;
  twoFaOff: number;
  total: number;
};

export type StaffListParams = {
  q?: string;
  role?: Role[];
  branchId?: string;
  status?: StaffStatus[];
  twoFa?: "on" | "off";
  lastActive?: "7" | "30" | "90" | "never";
  includeTest?: boolean;
  sort?: "name" | "role" | "joined" | "lastActive";
  order?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export type StaffTileFilter = "admins" | "managers" | "cashiers" | "chefs" | "riders" | "inactive" | "twoFaOff" | null;
