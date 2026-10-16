/** Neutral storefront placeholders — not tied to any demo restaurant. */
export const MENU_SEARCH_PLACEHOLDER = "Search menu…";
export const MENU_SEARCH_SUGGESTIONS = ["specials", "mains", "sides", "drinks", "desserts"];
export const MENU_EMPTY_HINT = "Try a different keyword or switch category.";
export const CART_EMPTY_HINT = "Add something from the menu to get started.";
export const ORDERS_EMPTY_HINT = "Your next order is one tap away.";
export const HOME_MENU_SEARCH_FALLBACK = "Try another search or browse categories below.";

export const MARQUEE_DEFAULT = ["Chef specials", "Fresh mains", "Family combos", "Sides & drinks", "Desserts"];

export const HERO_FALLBACK_SLIDES = [
  { id: "slide-1", title: "Today's specials", imageUrl: "/carousel/carousel-zinger.png", linkUrl: "/menu", sortOrder: 1 },
  { id: "slide-2", title: "House favorites", imageUrl: "/carousel/carousel-biryani.png", linkUrl: "/menu", sortOrder: 2 },
  { id: "slide-3", title: "Order online", imageUrl: "/carousel/carousel-broast.png", linkUrl: "/menu", sortOrder: 3 },
] as const;
