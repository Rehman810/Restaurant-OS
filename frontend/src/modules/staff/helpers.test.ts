import { describe, expect, it } from "vitest";
import {
  creatableRoles,
  lastActiveLabel,
  staffDisplayName,
  twoFaStatusLabel,
} from "./helpers";
import type { StaffListRow } from "./types";

describe("staff helpers", () => {
  it("derives readable display name from email", () => {
    expect(staffDisplayName({ name: "chef.ali@demo.restaurant", email: "chef.ali@demo.restaurant" })).toBe(
      "Chef Ali"
    );
  });

  it("labels never logged in", () => {
    expect(lastActiveLabel(null)).toBe("Never logged in");
  });

  it("flags required 2FA", () => {
    const row = {
      id: "1",
      name: "A",
      email: "a@b.com",
      phone: null,
      role: "ADMIN" as const,
      isActive: true,
      totpEnabled: false,
      twoFaRequired: true,
      twoFaCompliant: false,
      createdAt: new Date().toISOString(),
    } satisfies StaffListRow;
    expect(twoFaStatusLabel(row).warn).toBe(true);
  });

  it("limits creatable roles for manager", () => {
    expect(
      creatableRoles({ id: "1", name: "M", email: "m@x.com", role: "MANAGER" }).includes("ADMIN")
    ).toBe(false);
  });
});
