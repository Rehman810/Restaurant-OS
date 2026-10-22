import { describe, expect, it } from "vitest";
import { accessLevelForHttpMethod, parseModuleAccess } from "../src/lib/platform/module-access";

describe("module access", () => {
  it("maps legacy boolean to full or none", () => {
    expect(parseModuleAccess(true, false)).toEqual({ read: true, edit: true, delete: true });
    expect(parseModuleAccess(false, true)).toEqual({ read: false, edit: false, delete: false });
  });

  it("parses granular object", () => {
    expect(parseModuleAccess({ read: true, edit: false, delete: false }, false)).toEqual({
      read: true,
      edit: false,
      delete: false,
    });
  });

  it("maps HTTP methods to access levels", () => {
    expect(accessLevelForHttpMethod("GET")).toBe("read");
    expect(accessLevelForHttpMethod("POST")).toBe("edit");
    expect(accessLevelForHttpMethod("DELETE")).toBe("delete");
  });
});
