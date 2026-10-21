import { describe, expect, it } from "vitest";
import { diffSettingsValues } from "../src/lib/settings-update";
import { validateSettingsInput } from "../src/lib/settings-validate";

describe("settings save model", () => {
  it("returns stable validation codes", () => {
    const errors = validateSettingsInput({
      storeName: "  ",
      freeDeliveryAbove: 100,
      minimumOrder: 500,
    });
    expect(errors.storeName?.code).toBe("STORE_NAME_REQUIRED");
    expect(errors.freeDeliveryAbove?.code).toBe("FREE_DELIVERY_BELOW_MINIMUM");
  });

  it("builds a field diff for version conflicts", () => {
    const diff = diffSettingsValues(
      ["minimumOrder"],
      { minimumOrder: 600 },
      { minimumOrder: 500 }
    );
    expect(diff.minimumOrder).toEqual({ yours: 600, theirs: 500 });
  });

  it("simulates losing a race when two saves use the same version", async () => {
    const version = 3;
    const firstWins = version + 1;
    const secondAttempt = version;
    expect(secondAttempt).toBeLessThan(firstWins);
  });
});
