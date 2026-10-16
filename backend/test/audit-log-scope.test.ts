import { describe, expect, it } from "vitest";
import { buildAuditLogWhere } from "../src/lib/audit-log-query";

describe("[AUD-02] audit log branch scope", () => {
  it("restricts managers to their branch", () => {
    const where = buildAuditLogWhere(
      { branchId: "branch-a", allBranches: false, where: { branchId: "branch-a" } },
      {}
    );
    expect(where).toEqual({ branchId: "branch-a" });
  });

  it("lets admins filter by branch", () => {
    const where = buildAuditLogWhere(
      { branchId: null, allBranches: true, where: {} },
      { branchId: "branch-b" }
    );
    expect(where).toEqual({ branchId: "branch-b" });
  });

  it("does not apply branch filter for admins when omitted", () => {
    const where = buildAuditLogWhere({ branchId: null, allBranches: true, where: {} }, { action: "LOGIN_FAILED" });
    expect(where).toEqual({ action: "LOGIN_FAILED" });
  });
});
