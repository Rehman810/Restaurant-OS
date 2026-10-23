import {
  DEFAULT_DELIVERING_AREAS,
  defaultChargeForArea,
  KARACHI_AREAS,
} from "../karachi-areas";

export type DeliveryAreaTemplateRow = {
  name: string;
  deliveryCharge: number;
  isDelivering: boolean;
};

export function deliveryAreaRowsForCity(city: string): DeliveryAreaTemplateRow[] {
  const normalized = city.trim();
  if (!normalized) return [];
  if (normalized.toLowerCase() === "karachi") {
    return KARACHI_AREAS.map((name) => ({
      name,
      deliveryCharge: defaultChargeForArea(name),
      isDelivering: DEFAULT_DELIVERING_AREAS.has(name),
    }));
  }
  return ["Central", "North", "South", "East", "West", "Airport"].map((part, i) => ({
    name: part === "Airport" ? `${normalized} Airport` : `${normalized} ${part}`,
    deliveryCharge: 120 + i * 20,
    isDelivering: true,
  }));
}
