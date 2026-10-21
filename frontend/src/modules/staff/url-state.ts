import { Role } from "@/lib/types";
import type { StaffListParams, StaffTileFilter } from "./types";

export function parseStaffSearchParams(sp: URLSearchParams): StaffListParams & { tile: StaffTileFilter } {
  const q = sp.get("q") ?? "";
  const role = sp.getAll("role").filter(Boolean) as Role[];
  const status = sp.getAll("status").filter((s) => s === "active" || s === "inactive") as ("active" | "inactive")[];
  const twoFa = sp.get("twoFa") === "on" || sp.get("twoFa") === "off" ? (sp.get("twoFa") as "on" | "off") : undefined;
  const lastActive = ["7", "30", "90", "never"].includes(sp.get("lastActive") ?? "")
    ? (sp.get("lastActive") as "7" | "30" | "90" | "never")
    : undefined;
  const tile = (sp.get("tile") as StaffTileFilter) || null;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const sort = (sp.get("sort") as StaffListParams["sort"]) || "name";
  const order = sp.get("order") === "desc" ? "desc" : "asc";
  const includeTest = sp.get("includeTest") === "1";
  const branchId = sp.get("branchId") || undefined;

  let params: StaffListParams & { tile: StaffTileFilter } = {
    q,
    role,
    status,
    twoFa,
    lastActive,
    includeTest,
    branchId,
    page,
    sort,
    order,
    tile,
  };

  if (tile === "admins") params = { ...params, role: ["ADMIN"] };
  if (tile === "managers") params = { ...params, role: ["MANAGER"] };
  if (tile === "cashiers") params = { ...params, role: ["CASHIER"] };
  if (tile === "chefs") params = { ...params, role: ["CHEF"] };
  if (tile === "riders") params = { ...params, role: ["RIDER"] };
  if (tile === "inactive") params = { ...params, status: ["inactive"] };
  if (tile === "twoFaOff") params = { ...params, twoFa: "off" };

  return params;
}

export function staffParamsToSearchParams(params: StaffListParams & { tile?: StaffTileFilter }): URLSearchParams {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  params.role?.forEach((r) => sp.append("role", r));
  params.status?.forEach((s) => sp.append("status", s));
  if (params.twoFa) sp.set("twoFa", params.twoFa);
  if (params.lastActive) sp.set("lastActive", params.lastActive);
  if (params.branchId) sp.set("branchId", params.branchId);
  if (params.includeTest) sp.set("includeTest", "1");
  if (params.sort && params.sort !== "name") sp.set("sort", params.sort);
  if (params.order === "desc") sp.set("order", "desc");
  if (params.page && params.page > 1) sp.set("page", String(params.page));
  if (params.tile) sp.set("tile", params.tile);
  return sp;
}
