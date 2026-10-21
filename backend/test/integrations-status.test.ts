import { describe, expect, it } from "vitest";
import { getIntegrationsStatus } from "../src/lib/integrations-status";

describe("getIntegrationsStatus", () => {
  it("returns all integration slots", () => {
    const { items } = getIntegrationsStatus();
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(["smtp", "vapid", "google-places", "whatsapp"]);
  });
});
