import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { resolveAuditActionMeta } from "./audit-actions";
import { buildAuditSummary } from "./audit-summary";
import { isAuditLogSensitive } from "./audit-sensitive";
import { maskPiiValue } from "./audit-pii";
import { Role } from "@prisma/client";

type RawRow = {
  id: string;
  createdAt: Date;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string | null;
  actorId: string | null;
  actorRole: Role | null;
  branchId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
  meta: unknown;
  actor: { id: string; name: string; email: string; role: Role } | null;
  branch: { id: string; name: string; code: string } | null;
};

export type EnrichedAuditLog = {
  id: string;
  createdAt: string;
  action: string;
  actionLabel: string;
  category: string;
  sensitive: boolean;
  summary: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  entityAdminPath: string | null;
  actor: {
    id: string | null;
    name: string;
    role: string | null;
    kind: "staff" | "rider" | "customer" | "system";
  };
  branch: { id: string; name: string; code: string } | null;
  before: unknown;
  after: unknown;
  meta: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
};

function shortId(id: string) {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function entityAdminPath(entityType: string, entityId: string): string | null {
  const t = entityType.toLowerCase();
  if (t === "order" || t === "order_item") return `/admin/orders`;
  if (t === "menu_item") return `/admin/catalog/dishes`;
  if (t === "deal") return `/admin/catalog/deals`;
  if (t === "coupon") return `/admin/coupons`;
  if (t === "user") return `/admin/staff`;
  if (t === "customer") return `/admin/customers`;
  if (t === "cash_shift") return `/admin/shifts/${entityId}`;
  if (t === "branch") return `/admin/branches`;
  if (t === "store_settings") return `/admin/settings`;
  if (t === "inventory_item") return `/admin/inventory`;
  if (t === "reservation" || entityType === "Reservation") return `/admin/dine-in`;
  return null;
}

function actorKind(role: Role | null | undefined, actorId: string | null): EnrichedAuditLog["actor"]["kind"] {
  if (!actorId) return "system";
  if (role === Role.RIDER) return "rider";
  if (role === Role.CUSTOMER) return "customer";
  return "staff";
}

function actorDisplayName(row: RawRow): string {
  if (row.actor?.name) return row.actor.name;
  if (!row.actorId) return "System";
  return "Unknown user";
}

async function resolveEntityLabels(rows: RawRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const need = rows.filter((r) => !r.entityLabel);
  if (!need.length) return out;

  const orderIds = need.filter((r) => r.entityType === "order").map((r) => r.entityId);
  const menuIds = need.filter((r) => r.entityType === "menu_item").map((r) => r.entityId);
  const dealIds = need.filter((r) => r.entityType === "deal").map((r) => r.entityId);
  const userIds = need.filter((r) => r.entityType === "user").map((r) => r.entityId);
  const shiftIds = need.filter((r) => r.entityType === "cash_shift").map((r) => r.entityId);
  const couponIds = need.filter((r) => r.entityType === "coupon").map((r) => r.entityId);
  const invIds = need.filter((r) => r.entityType === "inventory_item").map((r) => r.entityId);
  const resIds = need.filter((r) => r.entityType === "Reservation" || r.entityType === "reservation").map((r) => r.entityId);

  const [orders, menus, deals, users, shifts, coupons, items, reservations] = await Promise.all([
    orderIds.length
      ? prisma.order.findMany({ where: { id: { in: orderIds } }, select: { id: true, orderNumber: true } })
      : [],
    menuIds.length
      ? prisma.menuItem.findMany({ where: { id: { in: menuIds } }, select: { id: true, name: true } })
      : [],
    dealIds.length ? prisma.deal.findMany({ where: { id: { in: dealIds } }, select: { id: true, title: true } }) : [],
    userIds.length
      ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [],
    shiftIds.length
      ? prisma.cashShift.findMany({
          where: { id: { in: shiftIds } },
          select: { id: true, openedAt: true, cashier: { select: { name: true } } },
        })
      : [],
    couponIds.length
      ? prisma.coupon.findMany({ where: { id: { in: couponIds } }, select: { id: true, code: true } })
      : [],
    invIds.length
      ? prisma.inventoryItem.findMany({ where: { id: { in: invIds } }, select: { id: true, name: true } })
      : [],
    resIds.length
      ? prisma.reservation.findMany({
          where: { id: { in: resIds } },
          select: { id: true, guestName: true, table: { select: { label: true } } },
        })
      : [],
  ]);

  for (const o of orders) out.set(`order:${o.id}`, o.orderNumber);
  for (const m of menus) out.set(`menu_item:${m.id}`, m.name);
  for (const d of deals) out.set(`deal:${d.id}`, d.title);
  for (const u of users) out.set(`user:${u.id}`, u.name || u.email);
  for (const s of shifts) {
    const d = s.openedAt.toISOString().slice(0, 10);
    out.set(`cash_shift:${s.id}`, `Shift ${d}${s.cashier?.name ? ` · ${s.cashier.name}` : ""}`);
  }
  for (const c of coupons) out.set(`coupon:${c.id}`, c.code);
  for (const i of items) out.set(`inventory_item:${i.id}`, i.name);
  for (const r of reservations) {
    out.set(`Reservation:${r.id}`, r.guestName || r.table?.label || "Reservation");
    out.set(`reservation:${r.id}`, r.guestName || r.table?.label || "Reservation");
  }

  return out;
}

export async function enrichAuditLogs(rows: RawRow[], maskPii = true): Promise<EnrichedAuditLog[]> {
  const resolved = await resolveEntityLabels(rows);
  return rows.map((row) => {
    const meta = resolveAuditActionMeta(row.action);
    const key = `${row.entityType}:${row.entityId}`;
    const entityLabel =
      row.entityLabel?.trim() ||
      resolved.get(key) ||
      resolved.get(`${row.entityType.toLowerCase()}:${row.entityId}`) ||
      shortId(row.entityId);

    const sensitive = isAuditLogSensitive({
      action: row.action,
      entityType: row.entityType,
      before: row.before,
      after: row.after,
    });

    const summary = buildAuditSummary({
      action: row.action,
      before: row.before,
      after: row.after,
      reason: row.reason,
      meta: row.meta,
    });

    const role = row.actorRole ?? row.actor?.role ?? null;

    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      action: row.action,
      actionLabel: meta.label,
      category: meta.category,
      sensitive,
      summary,
      entityType: row.entityType,
      entityId: row.entityId,
      entityLabel,
      entityAdminPath: entityAdminPath(row.entityType, row.entityId),
      actor: {
        id: row.actorId,
        name: actorDisplayName(row),
        role: role,
        kind: actorKind(role, row.actorId),
      },
      branch: row.branch,
      before: maskPii ? maskPiiValue(row.before) : row.before,
      after: maskPii ? maskPiiValue(row.after) : row.after,
      meta: maskPii ? maskPiiValue(row.meta) : row.meta,
      reason: row.reason ? (maskPii ? String(maskPiiValue(row.reason)) : row.reason) : null,
      ip: row.ip,
      userAgent: row.userAgent,
    };
  });
}

export type AuditLogListFilters = {
  action?: string;
  category?: string;
  actorId?: string;
  entityType?: string;
  entityId?: string;
  branchId?: string;
  search?: string;
  from?: Date;
  to?: Date;
  sensitiveOnly?: boolean;
};
