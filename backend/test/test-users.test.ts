import { describe, expect, it } from "vitest";
import {
  isTestDatabaseUrl,
  isTestEmailPattern,
  isLoginBlockedForTestUser,
  TEST_USER_DEFAULT_PASSWORD,
} from "../src/lib/test-users";

describe("test user helpers", () => {
  it("detects @test.local and known prefixes", () => {
    expect(isTestEmailPattern("adm-br-123@test.local")).toBe(true);
    expect(isTestEmailPattern("matrix-admin-abc@test.local")).toBe(true);
    expect(isTestEmailPattern("chef@demo.restaurant")).toBe(false);
  });

  it("recognizes test database URLs", () => {
    expect(isTestDatabaseUrl("postgresql://u:p@localhost:5433/restaurant_os_test?schema=public")).toBe(
      true
    );
    expect(isTestDatabaseUrl("postgresql://u:p@localhost:5432/restaurant_os?schema=public")).toBe(
      false
    );
  });

  it("blocks flagged users in production only", () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    expect(isLoginBlockedForTestUser({ email: "x@test.local", isTest: true })).toBe(true);
    expect(isLoginBlockedForTestUser({ email: "admin@admin.com", isTest: false })).toBe(false);
    process.env.NODE_ENV = "development";
    expect(isLoginBlockedForTestUser({ email: "x@test.local", isTest: true })).toBe(false);
    process.env.NODE_ENV = prev;
  });

  it("documents shared test password constant", () => {
    expect(TEST_USER_DEFAULT_PASSWORD.length).toBeGreaterThan(8);
  });
});
