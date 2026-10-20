import { emitMenuCatalogChanged } from "../realtime";

export function notifyMenuChanged(branchIds?: string[]) {
  emitMenuCatalogChanged(branchIds);
}
