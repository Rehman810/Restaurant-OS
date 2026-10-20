import { describe, expect, it } from "vitest";
import { buildCsv, escapeCsvCell } from "../src/lib/analytics/csv";

describe("analytics csv", () => {
  it("prefixes formula injection cells", () => {
    expect(escapeCsvCell("=SUM(1,1)")).toContain("'=SUM(1,1)");
  });

  it("includes UTF-8 BOM", () => {
    const csv = buildCsv([["a", "b"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("a,b");
  });
});
