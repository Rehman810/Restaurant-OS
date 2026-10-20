import { FulfillmentType, OrderSource, OrderStatus, Prisma, Role } from "@prisma/client";
import type { Request } from "express";
import type { BranchScope } from "../branch-scope";
import { utcRangeForStoreDateKey } from "../dashboard/dates";
import { paymentFilterMatches, deriveOrderPayment, type OrderPaymentRow } from "./payment";

export type AdminOrdersSort = "newest" | "oldest" | "lateFirst" | "total";

export type ParsedAdminOrdersQuery = {
  from?: string;
  to?: string;
  statuses: OrderStatus[];
  types: FulfillmentType[];
  sources: OrderSource[];
  paymentFilters: string[];
  riderId?: string;
  branchId?: string;
  q?: string;
  sort: AdminOrdersSort;
  page: number;
  pageSize: number;
};

function parseArray<T extends string>(raw: unknown, allowed: readonly T[]): T[] {
  const parts: string[] = [];
  if (Array.isArray(raw)) {
    for (const v of raw) parts.push(String(v));
  } else if (typeof raw === "string" && raw.trim()) {
    parts.push(...raw.split(","));
  }
  return parts.map((s) => s.trim()).filter((s): s is T => allowed.includes(s as T));
}

export function parseAdminOrdersQuery(req: Request): ParsedAdminOrdersQuery {
  const statusAllowed = Object.values(OrderStatus);
  const typeAllowed = Object.values(FulfillmentType);
  const sourceAllowed = Object.values(OrderSource);

  const statusFromBracket = req.query["status[]"];
  const typeFromBracket = req.query["type[]"];
  const sourceFromBracket = req.query["source[]"];

  const statuses = parseArray(
    statusFromBracket ?? req.query.status,
    statusAllowed
  );
  const types = parseArray(typeFromBracket ?? req.query.type, typeAllowed);
  const sources = parseArray(sourceFromBracket ?? req.query.source, sourceAllowed);

  const paymentRaw = String(req.query.payment || "").trim();
  const paymentFilters = paymentRaw
    ? paymentRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const sortRaw = String(req.query.sort || "newest").trim();
  const sort: AdminOrdersSort =
    sortRaw === "oldest" || sortRaw === "lateFirst" || sortRaw === "total" ? sortRaw : "newest";

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));

  return {
    from: String(req.query.from || "").trim() || undefined,
    to: String(req.query.to || "").trim() || undefined,
    statuses,
    types,
    sources,
    paymentFilters,
    riderId: String(req.query.riderId || "").trim() || undefined,
    branchId: String(req.query.branchId || "").trim() || undefined,
    q: String(req.query.q || req.query.search || "").trim() || undefined,
    sort,
    page,
    pageSize,
  };
}

export function buildAdminOrdersWhere(
  scope: BranchScope,
  query: ParsedAdminOrdersQuery,
  timeZone: string,
  riderUserId?: string
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = { ...scope.where };

  if (query.branchId && scope.allBranches) {
    where.branchId = query.branchId;
  }

  if (riderUserId) {
    where.riderId = riderUserId;
  } else if (query.riderId) {
    where.riderId = query.riderId;
  }

  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from)) {
    createdAt.gte = utcRangeForStoreDateKey(query.from, timeZone).startUtc;
  }
  if (query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) {
    createdAt.lte = utcRangeForStoreDateKey(query.to, timeZone).endUtc;
  }
  if (createdAt.gte || createdAt.lte) {
    where.createdAt = createdAt;
  }

  if (query.statuses.length) {
    where.status = { in: query.statuses };
  }
  if (query.types.length) {
    where.fulfillmentType = { in: query.types };
  }
  if (query.sources.length) {
    where.orderSource = { in: query.sources };
  }

  if (query.q) {
    const q = query.q;
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerPhone: { contains: q } },
      { deliveryAddress: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

/** Payment filter applied in memory after row derivation (Prisma has no derived field). */
export function rowMatchesPaymentFilters(
  row: OrderPaymentRow,
  filters: string[]
): boolean {
  if (!filters.length) return true;
  const derived = deriveOrderPayment(row);
  return filters.some((f) => paymentFilterMatches(f, derived));
}

export function riderScopeUserId(role: Role, userId: string): string | undefined {
  if (role === Role.RIDER) return userId;
  return undefined;
}
