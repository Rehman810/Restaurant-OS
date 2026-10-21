export const SEGMENT_NEW_ORDER_COUNT = 1;
export const SEGMENT_REGULAR_MIN_ORDERS = 3;
export const SEGMENT_VIP_TOP_FRACTION = 0.1;
export const SEGMENT_AT_RISK_MIN_DAYS = 30;
export const SEGMENT_LAPSED_MIN_DAYS = 60;

export type CustomerSegment = "new" | "regular" | "vip" | "at_risk" | "lapsed";

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: "New",
  regular: "Regular",
  vip: "VIP",
  at_risk: "At risk",
  lapsed: "Lapsed",
};

export const SEGMENT_FILTER_OPTIONS: { id: CustomerSegment | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "regular", label: "Regular" },
  { id: "vip", label: "VIP" },
  { id: "at_risk", label: "At risk" },
  { id: "lapsed", label: "Lapsed" },
];
