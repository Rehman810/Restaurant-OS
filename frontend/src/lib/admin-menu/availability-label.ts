import type { AdminDishAvailability } from "./types";

export function availabilityLabel(av: AdminDishAvailability): string {
  if (av.state === "available") return "Available";
  if (av.until === "endOfDay") return "Sold out (today)";
  if (av.until) {
    try {
      const d = new Date(av.until);
      return `Sold out until ${d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}`;
    } catch {
      return "Sold out";
    }
  }
  return "Sold out";
}
