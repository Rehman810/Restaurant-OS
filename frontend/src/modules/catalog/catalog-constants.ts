import type { CategoryFormData } from "@/components/admin/CategoryFormSheet";
import type { DealFormData } from "@/components/admin/DealFormSheet";
import type { MenuFormData } from "@/components/admin/MenuFormSheet";

export const emptyDish: MenuFormData = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  category: "Main Course",
  imageUrl: "",
  isAvailable: true,
  optionGroups: [],
  addons: [],
  printStationId: "",
};

export const emptyDeal: DealFormData = {
  title: "",
  description: "",
  category: "",
  dealPrice: "",
  imageUrl: "",
  isVisible: true,
  channelOnline: true,
  channelPos: true,
  channelDineIn: true,
  perOrderLimit: "",
  scheduleStartsAt: "",
  scheduleEndsAt: "",
  scheduleStartTime: "",
  scheduleEndTime: "",
  scheduleDays: [],
  items: [{ menuItemId: "", quantity: 1 }],
};

export const emptyCategory: CategoryFormData = {
  name: "",
  tagline: "",
  imageUrl: "",
  isVisible: true,
  scheduleDays: [],
  scheduleStartTime: "",
  scheduleEndTime: "",
};

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return undefined;
  return h * 60 + m;
}

export function minutesToTimeLabel(mins: number | null | undefined) {
  if (mins == null) return "";
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}
