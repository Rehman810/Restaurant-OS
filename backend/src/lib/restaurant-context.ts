import { AsyncLocalStorage } from "async_hooks";

/** Stable id inserted by the white-label migration. One deployment defaults to this row. */
export const DEFAULT_RESTAURANT_ID = "11111111-1111-4111-8111-111111111111";

const als = new AsyncLocalStorage<string>();
let fallback = process.env.RESTAURANT_ID || DEFAULT_RESTAURANT_ID;

export function setDefaultRestaurantId(id: string) {
  fallback = id;
}

export function getRestaurantId(): string {
  return als.getStore() || fallback;
}

export function runWithRestaurant<T>(id: string, fn: () => T): T {
  return als.run(id, fn);
}

const TENANT_MODELS = new Set([
  "User",
  "Category",
  "MenuItem",
  "StoreSettings",
  "PromoBanner",
  "Deal",
  "DeliveryArea",
  "Order",
  "OrderBlock",
  "Testimonial",
  "Supplier",
  "InventoryItem",
]);

export function isTenantModel(model?: string) {
  return !!model && TENANT_MODELS.has(model);
}
