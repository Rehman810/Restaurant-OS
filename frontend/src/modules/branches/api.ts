import { api } from "@/lib/api";
import type {
  AdminBranch,
  BranchesListRange,
  BranchesListResponse,
  CopyFromOptions,
  DeactivationCheck,
  Branch,
} from "./types";

export async function fetchStaffBranches() {
  return api<{ branches: Branch[]; defaultBranchId: string }>("/branches");
}

export async function fetchAdminBranches(range: BranchesListRange = "today") {
  return api<BranchesListResponse>(`/admin/branches?range=${range}`);
}

export type BranchWritePayload = {
  name: string;
  code?: string;
  addressLine?: string;
  area?: string;
  city?: string;
  address?: string;
  phone?: string;
  email?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  managerUserId?: string | null;
  acceptsOnlineOrders?: boolean;
  isDefault?: boolean;
  sortOrder?: number;
  copyFrom?: { sourceBranchId: string; options: CopyFromOptions };
};

export async function createBranch(payload: BranchWritePayload) {
  return api<{ branch: AdminBranch; copySummary?: unknown }>("/admin/branches", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateBranch(id: string, payload: Partial<BranchWritePayload & { isActive?: boolean }>) {
  return api<{ branch: AdminBranch }>(`/admin/branches/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function makeBranchDefault(id: string) {
  return api<{ branch: AdminBranch }>(`/admin/branches/${id}/make-default`, { method: "POST" });
}

export async function toggleBranchOnlineOrdering(id: string, enabled: boolean, reason: string) {
  return api<{ branch: AdminBranch }>(`/admin/branches/${id}/online-ordering`, {
    method: "PATCH",
    body: JSON.stringify({ enabled, reason }),
  });
}

export async function fetchDeactivationCheck(id: string) {
  return api<DeactivationCheck>(`/admin/branches/${id}/deactivation-check`);
}

export async function deactivateBranch(
  id: string,
  body: { staffAction?: "reassign" | "revoke"; targetBranchId?: string }
) {
  return api<{ branch: AdminBranch }>(`/admin/branches/${id}/deactivate`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function reactivateBranch(id: string) {
  return api<{ branch: AdminBranch }>(`/admin/branches/${id}/reactivate`, { method: "POST" });
}

export async function copyBranchFrom(id: string, sourceBranchId: string, options: CopyFromOptions) {
  return api<{ copySummary: unknown }>(`/admin/branches/${id}/copy-from`, {
    method: "POST",
    body: JSON.stringify({ sourceBranchId, options }),
  });
}
