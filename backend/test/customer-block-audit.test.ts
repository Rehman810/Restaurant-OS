import { describe, expect, it } from "vitest";
import { AuditAction } from "../src/lib/audit-actions";

describe("customer block audit actions", () => {
  it("defines block and unblock audit codes", () => {
    expect(AuditAction.CUSTOMER_BLOCKED).toBe("customer.blocked");
    expect(AuditAction.CUSTOMER_UNBLOCKED).toBe("customer.unblocked");
  });
});
