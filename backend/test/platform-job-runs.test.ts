import { describe, expect, it } from "vitest";
import { platformJobLeaseMs } from "../src/lib/platform/job-runs";

describe("platform job runs", () => {
  it("uses a positive default lease", () => {
    expect(platformJobLeaseMs()).toBeGreaterThan(0);
  });
});
