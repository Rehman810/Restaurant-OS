import { describe, expect, it } from "vitest";
import { assertIntegrationTestDatabase } from "./helpers/db-guard";

describe("assertIntegrationTestDatabase", () => {
  it("allows dedicated test database URLs", () => {
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://x@localhost:5433/restaurant_os_test?schema=public";
    delete process.env.INTEGRATION_TEST_DB;
    expect(() => assertIntegrationTestDatabase()).not.toThrow();
    process.env.DATABASE_URL = prev;
  });

  it("blocks default dev database name", () => {
    const prev = process.env.DATABASE_URL;
    const prevOverride = process.env.INTEGRATION_TEST_DB;
    process.env.DATABASE_URL = "postgresql://x@localhost:5432/restaurant_os?schema=public";
    delete process.env.INTEGRATION_TEST_DB;
    expect(() => assertIntegrationTestDatabase()).toThrow(/Refusing to run integration tests/);
    process.env.DATABASE_URL = prev;
    process.env.INTEGRATION_TEST_DB = prevOverride;
  });
});
