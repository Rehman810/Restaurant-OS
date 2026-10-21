/**
 * Detection and guards for automated-test user accounts.
 */

export const DEMO_ADMIN_EMAIL = "admin@admin.com";

/** Shared default password in test helpers (not used in production seed unless configured). */
export const TEST_USER_DEFAULT_PASSWORD = "test-pass-123";

const TEST_EMAIL_SUFFIX = "@test.local";

const TEST_EMAIL_PREFIX_PATTERNS = [
  /^adm-br-/i,
  /^mgr-br-/i,
  /^cpy-adm-/i,
  /^admin-par-/i,
  /^admin-dash-/i,
  /^mgr-ds-/i,
  /^mgr-scope-/i,
  /^mgr-ext-/i,
  /^matrix-/i,
  /^adm-ord-/i,
  /^change-pw-/i,
  /^chef-scope-/i,
  /^cashier-idor-/i,
  /^cust-[ab]-/i,
];

export function isTestEmailPattern(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (normalized.endsWith(TEST_EMAIL_SUFFIX)) return true;
  const local = normalized.split("@")[0] ?? "";
  return TEST_EMAIL_PREFIX_PATTERNS.some((re) => re.test(local));
}

export function isTestUserRecord(user: { email: string; isTest?: boolean }): boolean {
  return Boolean(user.isTest) || isTestEmailPattern(user.email);
}

const SAFE_TEST_DB_PATTERNS = [
  /restaurant_os_test/i,
  /restaurant_os_ci/i,
  /restaurant_os_e2e/i,
  /_test(\?|$|\/)/i,
];

export function isTestDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  return SAFE_TEST_DB_PATTERNS.some((re) => re.test(databaseUrl));
}

export function assertSafeToCreateTestUsers(): void {
  if (process.env.NODE_ENV === "test") return;
  if (isTestDatabaseUrl(process.env.DATABASE_URL)) return;
  throw new Error(
    "Refusing to create test users: set DATABASE_URL to a dedicated test database " +
      "(e.g. restaurant_os_test) or run with NODE_ENV=test."
  );
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isLoginBlockedForTestUser(user: { email: string; isTest: boolean }): boolean {
  if (!isProductionRuntime()) return false;
  return isTestUserRecord(user);
}

export function isProtectedStaffUser(user: {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
}): boolean {
  if (user.email.toLowerCase() === DEMO_ADMIN_EMAIL) return true;
  return false;
}
