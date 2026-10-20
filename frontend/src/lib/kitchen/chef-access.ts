/** Paths a CHEF may open in the admin app (kitchen board only). */
export function chefAdminPathAllowed(path: string): boolean {
  const base = path.split("?")[0].split("#")[0];
  return base === "/admin/kitchen";
}
