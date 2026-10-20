import { describe, expect, it } from "vitest";
import { chefAdminPathAllowed } from "./chef-access";
import { navSectionsForRole } from "@/modules/admin/navigation";

describe("chefAdminPathAllowed", () => {
  it("allows only the kitchen board", () => {
    expect(chefAdminPathAllowed("/admin/kitchen")).toBe(true);
    expect(chefAdminPathAllowed("/admin/kitchen?kiosk=1")).toBe(true);
    expect(chefAdminPathAllowed("/admin")).toBe(false);
    expect(chefAdminPathAllowed("/admin/analytics")).toBe(false);
    expect(chefAdminPathAllowed("/admin/reports/tax")).toBe(false);
    expect(chefAdminPathAllowed("/admin/kitchen/stations")).toBe(false);
  });
});

describe("navSectionsForRole CHEF", () => {
  it("shows kitchen only", () => {
    const sections = navSectionsForRole("CHEF");
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toEqual(["/admin/kitchen"]);
  });
});
