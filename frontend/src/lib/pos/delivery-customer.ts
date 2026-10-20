export const POS_WALK_IN_LABEL = "Walk-in";

/** True when the name is empty or the dine-in default (not valid for delivery). */
export function isWalkInCustomerName(name: string): boolean {
  const n = name.trim().toLowerCase().replace(/\s+/g, " ");
  return !n || n === "walk-in" || n === "walk in";
}

export function resolvePosCustomerNameForCheckout(
  mode: "PICKUP" | "DINE_IN" | "DELIVERY",
  name: string
): string {
  const trimmed = name.trim();
  if (mode === "DELIVERY") return trimmed;
  return trimmed || POS_WALK_IN_LABEL;
}

export type DeliveryFieldKey = "name" | "phone" | "area" | "address";

const ORDER: DeliveryFieldKey[] = ["name", "phone", "area", "address"];

export function getDeliveryFieldErrors(input: {
  deliveryAreaId: string;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
}): Partial<Record<DeliveryFieldKey, string>> {
  const errors: Partial<Record<DeliveryFieldKey, string>> = {};
  if (isWalkInCustomerName(input.customerName)) {
    errors.name = "Enter the customer’s real name (Walk-in is only for dine-in / takeaway).";
  }
  if (!input.customerPhone.trim()) {
    errors.phone = "Enter a phone number for this delivery.";
  }
  if (!input.deliveryAreaId) {
    errors.area = "Choose a delivery area.";
  }
  if (!input.deliveryAddress.trim()) {
    errors.address = "Enter street, building, and landmark.";
  }
  return errors;
}

export function firstDeliveryCheckoutMessage(
  errors: Partial<Record<DeliveryFieldKey, string>>
): string | null {
  for (const key of ORDER) {
    const msg = errors[key];
    if (msg) return msg;
  }
  return null;
}

export function deliveryCheckoutIncomplete(input: {
  deliveryAreaId: string;
  deliveryAddress: string;
  customerName: string;
  customerPhone: string;
}): boolean {
  return Object.keys(getDeliveryFieldErrors(input)).length > 0;
}
