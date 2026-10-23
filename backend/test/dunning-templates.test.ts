import { describe, expect, it } from "vitest";
import { renderDunningTemplate } from "../src/lib/platform/dunning-templates";

describe("renderDunningTemplate", () => {
  it("substitutes variables in default overdue template", () => {
    const body = renderDunningTemplate("paymentOverdue", {}, {
      invoiceNumber: "INV-1",
      amountPkr: "5000",
      dueAt: "2026-01-01",
    });
    expect(body).toContain("INV-1");
    expect(body).toContain("5000");
  });
});
