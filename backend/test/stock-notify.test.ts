import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/lib/notifications/ops", () => ({
  notifyStockLevel: vi.fn(),
}));

import { notifyStockLevel } from "../src/lib/notifications/ops";
import { maybeEmitStockAlerts } from "../src/lib/inventory/stock-notify";

describe("maybeEmitStockAlerts", () => {
  beforeEach(() => {
    vi.mocked(notifyStockLevel).mockClear();
  });

  const base = {
    branchId: "b1",
    itemId: "i1",
    itemName: "Tomatoes",
    unit: "KG",
    reorderPoint: 10,
  };

  it("emits out of stock when crossing zero", () => {
    maybeEmitStockAlerts({ ...base, oldQty: 2, newQty: 0 });
    expect(notifyStockLevel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "inventory_out_of_stock" })
    );
  });

  it("emits low stock when crossing reorder point", () => {
    maybeEmitStockAlerts({ ...base, oldQty: 12, newQty: 8 });
    expect(notifyStockLevel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "inventory_low_stock" })
    );
  });

  it("emits restocked when rising above reorder", () => {
    maybeEmitStockAlerts({ ...base, oldQty: 5, newQty: 20 });
    expect(notifyStockLevel).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "inventory_restocked" })
    );
  });
});
