/** Dev-only quick login helpers; never enabled in production builds. */
export function isDemoLoginEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";
}

export const DEMO_LOGIN_ACCOUNTS = [
  { label: "Admin", email: "admin@admin.com", password: "admin" },
  { label: "Customer", email: "customer@demo.restaurant", password: "admin" },
] as const;
