const SAFE_DB_PATTERNS = [
  /restaurant_os_test/i,
  /restaurant_os_ci/i,
  /restaurant_os_e2e/i,
  /_test(\?|$|\/)/i,
];

/** Fail fast when integration tests would mutate a dev/demo database. */
export function assertIntegrationTestDatabase() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return;
  if (process.env.INTEGRATION_TEST_DB === "1") return;
  const safe = SAFE_DB_PATTERNS.some((re) => re.test(url));
  if (!safe) {
    throw new Error(
      `Refusing to run integration tests against non-test DATABASE_URL (${url.replace(/:[^:@/]+@/, ":***@")}). ` +
        `Use backend/.env.test (e.g. restaurant_os_test on port 5433) or set INTEGRATION_TEST_DB=1 to override.`
    );
  }
}
