import { describe, expect, it } from "vitest";
import {
  AuditAction,
  prettifyUnknownActionCode,
  resolveAuditActionMeta,
} from "../src/lib/audit-actions";
import {
  AUDIT_SENSITIVE_KITCHEN_STATUSES,
  AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD,
  isAuditLogSensitive,
} from "../src/lib/audit-sensitive";
import { buildAuditLogWhere } from "../src/lib/audit-log-query";
import { orderStatusAuditPayload } from "../src/lib/audit";
import { maskEmail, maskPiiInText } from "../src/lib/audit-pii";
import { OrderStatus } from "@prisma/client";

describe("audit action display", () => {
  it("maps legacy SCREAMING_SNAKE codes", () => {
    expect(resolveAuditActionMeta("ORDER_STATUS_CHANGED").label).toBe("Order status changed");
    expect(resolveAuditActionMeta("SHIFT_OPENED").category).toBe("Cash");
  });

  it("maps legacy dotted reservation codes", () => {
    expect(resolveAuditActionMeta("reservation.confirm").label).toBe("Reservation confirmed");
    expect(resolveAuditActionMeta("reservation.seat").label).toBe("Reservation seated");
  });

  it("prettifies unknown codes", () => {
    expect(prettifyUnknownActionCode("foo.bar_baz")).toBe("Foo Bar Baz");
  });

  it("uses canonical entity.verb codes for new constants", () => {
    expect(AuditAction.ORDER_CANCELLED).toBe("order.cancelled");
    expect(resolveAuditActionMeta(AuditAction.ORDER_CANCELLED).label).toBe("Order cancelled");
  });
});

describe("audit writers payload helpers", () => {
  it("stores from/to for status changes", () => {
    const p = orderStatusAuditPayload(OrderStatus.CONFIRMED, OrderStatus.PREPARING);
    expect(p.before).toEqual({ from: "CONFIRMED", status: "CONFIRMED" });
    expect(p.after).toEqual({ to: "PREPARING", status: "PREPARING" });
  });
});

describe("sensitive rules", () => {
  it("flags cancel after cooking", () => {
    expect(
      isAuditLogSensitive({
        action: "ORDER_CANCELLED",
        entityType: "order",
        before: { status: "PREPARING" },
      })
    ).toBe(true);
    expect(
      isAuditLogSensitive({
        action: AuditAction.ORDER_CANCELLED,
        entityType: "order",
        before: { from: "READY" },
      })
    ).toBe(true);
  });

  it("does not flag cancel before kitchen", () => {
    expect(
      isAuditLogSensitive({
        action: AuditAction.ORDER_CANCELLED,
        entityType: "order",
        before: { status: OrderStatus.CONFIRMED },
      })
    ).toBe(false);
  });

  it("flags shift variance at threshold", () => {
    expect(
      isAuditLogSensitive({
        action: AuditAction.SHIFT_CLOSED,
        entityType: "cash_shift",
        after: { variance: AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD },
      })
    ).toBe(true);
    expect(
      isAuditLogSensitive({
        action: AuditAction.SHIFT_CLOSED,
        entityType: "cash_shift",
        after: { variance: AUDIT_SHIFT_VARIANCE_SENSITIVE_THRESHOLD - 1 },
      })
    ).toBe(false);
  });

  it("kitchen sensitive statuses include PREPARING", () => {
    expect(AUDIT_SENSITIVE_KITCHEN_STATUSES.has("PREPARING")).toBe(true);
  });
});

describe("audit log filters", () => {
  it("scopes to branch", () => {
    const where = buildAuditLogWhere({ branchId: "b1", allBranches: false, where: {} }, {});
    expect(where).toEqual({ branchId: "b1" });
  });

  it("filters by category and sensitive flag", () => {
    const where = buildAuditLogWhere(
      { branchId: null, allBranches: true, where: {} },
      { category: "Security", sensitiveOnly: true }
    );
    expect(where).toHaveProperty("AND");
  });

  it("filters by action and actor", () => {
    const where = buildAuditLogWhere(
      { branchId: null, allBranches: true, where: {} },
      { action: AuditAction.LOGIN_FAILED, actorId: "u1" }
    );
    expect(where).toMatchObject({ AND: [{ action: AuditAction.LOGIN_FAILED }, { actorId: "u1" }] });
  });
});

describe("PII masking", () => {
  it("masks emails in text and csv fields", () => {
    expect(maskEmail("user@example.com")).toBe("u***@example.com");
    expect(maskPiiInText("Contact user@example.com or 0300-1234567")).toContain("***");
  });
});
