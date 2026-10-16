import { describe, expect, it } from "vitest";

function classify(
  qty: number,
  margin: number,
  medianQty: number,
  medianMargin: number
): string {
  const highVol = qty >= medianQty;
  const highMargin = margin >= medianMargin;
  if (highVol && highMargin) return "STAR";
  if (highVol && !highMargin) return "PLOWHORSE";
  if (!highVol && highMargin) return "PUZZLE";
  return "DOG";
}

describe("[RPT-01] menu engineering classification", () => {
  it("classifies quadrants from medians", () => {
    expect(classify(100, 40, 50, 30)).toBe("STAR");
    expect(classify(100, 20, 50, 30)).toBe("PLOWHORSE");
    expect(classify(10, 40, 50, 30)).toBe("PUZZLE");
    expect(classify(10, 10, 50, 30)).toBe("DOG");
  });
});
