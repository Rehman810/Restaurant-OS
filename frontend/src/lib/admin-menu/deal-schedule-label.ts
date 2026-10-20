import type { DealScheduleStatus } from "./types";

export function dealScheduleStatusLabel(status: DealScheduleStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "scheduled":
      return "Scheduled";
    case "expired":
      return "Expired";
    case "hidden":
      return "Hidden";
    default:
      return status;
  }
}

export function channelSummary(channels: { online: boolean; pos: boolean; dineIn: boolean }): string {
  const parts: string[] = [];
  if (channels.online) parts.push("Online");
  if (channels.pos) parts.push("POS");
  if (channels.dineIn) parts.push("Dine-in");
  return parts.length ? parts.join(", ") : "No channels";
}
