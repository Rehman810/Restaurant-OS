export type MenuTab = "dishes" | "deals" | "categories";

export function parseMenuTab(raw: string | null): MenuTab {
  if (raw === "deals" || raw === "categories") return raw;
  return "dishes";
}

export function menuTabToParam(tab: MenuTab): string | undefined {
  return tab === "dishes" ? undefined : tab;
}
