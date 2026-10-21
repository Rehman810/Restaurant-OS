export type ContactFieldKey =
  | "phone"
  | "whatsapp"
  | "address"
  | "latitude"
  | "longitude"
  | "facebookUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | "youtubeUrl";

export const CONTACT_FIELD_USAGE: Record<ContactFieldKey, readonly string[]> = {
  phone: ["Store footer", "Homepage delivery block", "Call / WhatsApp FAB", "POS & kitchen receipts"],
  whatsapp: ["WhatsApp FAB", "POS receipt header"],
  address: ["Store footer", "Checkout pickup label", "POS receipt", "Tax invoice (if legal address empty)"],
  latitude: ["Future map embeds", "Delivery distance hints"],
  longitude: ["Future map embeds", "Delivery distance hints"],
  facebookUrl: ["Store footer social links"],
  instagramUrl: ["Store footer social links"],
  tiktokUrl: ["Store footer social links"],
  youtubeUrl: ["Store footer social links"],
};

export const CONTACT_EDITED_ELSEWHERE = [
  { label: "City & footer tagline", href: "/admin/settings/branding-theme" },
  { label: "Tax legal address", href: "/admin/settings/tax-receipts" },
  { label: "Branch contacts", href: "/admin/branches" },
] as const;
