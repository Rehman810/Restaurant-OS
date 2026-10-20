export const MENU_ALLERGENS = [
  "Gluten",
  "Dairy",
  "Eggs",
  "Nuts",
  "Peanuts",
  "Soy",
  "Fish",
  "Shellfish",
  "Sesame",
] as const;

export type MenuAllergen = (typeof MENU_ALLERGENS)[number];

export const DISH_NAME_MAX = 80;
export const DISH_DESC_MAX = 300;
export const BULK_MAX_IDS = 100;
