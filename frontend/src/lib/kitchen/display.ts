export type KitchenTextSize = "S" | "M" | "L";

export const KITCHEN_TEXT_SIZE_KEY = "uff-kitchen-text-size";
export const KITCHEN_KIOSK_KEY = "uff-kitchen-kiosk";

export const KITCHEN_TEXT_SCALE: Record<KitchenTextSize, number> = {
  S: 0.9,
  M: 1,
  L: 1.15,
};

export function readKitchenTextSize(): KitchenTextSize {
  if (typeof window === "undefined") return "M";
  const v = localStorage.getItem(KITCHEN_TEXT_SIZE_KEY);
  if (v === "S" || v === "L") return v;
  return "M";
}

export function writeKitchenTextSize(size: KitchenTextSize) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KITCHEN_TEXT_SIZE_KEY, size);
}

export function readKitchenKiosk(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(KITCHEN_KIOSK_KEY) === "1";
}

export function writeKitchenKiosk(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) sessionStorage.setItem(KITCHEN_KIOSK_KEY, "1");
  else sessionStorage.removeItem(KITCHEN_KIOSK_KEY);
  window.dispatchEvent(new Event("kitchen-kiosk-change"));
}
