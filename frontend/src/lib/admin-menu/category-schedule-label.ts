import type { CategoryScheduleStatus } from "./types";

export function categoryScheduleStatusLabel(status: CategoryScheduleStatus): string {
  switch (status) {
    case "active":
      return "On menu";
    case "scheduled":
      return "Off hours";
    case "hidden":
      return "Hidden";
    default:
      return status;
  }
}
