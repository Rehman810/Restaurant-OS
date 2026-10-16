import type { InventoryTab } from "./types";

export const INVENTORY_TAB_HELP: Record<
  InventoryTab,
  { title: string; bullets: string[] }
> = {
  stock: {
    title: "Stock",
    bullets: [
      "On-hand quantity is per branch (use the header branch switcher).",
      "Every change writes a ledger movement — stock is never edited silently.",
      "Low / out badges use reorder level; expiring uses batches within 7 days.",
      "Adjust opens add, remove, or set-exact with a reason (wastage creates a waste movement).",
    ],
  },
  receive: {
    title: "Receive (purchases)",
    bullets: [
      "Posting a purchase increases stock, updates weighted average cost, and logs PURCHASE movements.",
      "Expiry date on a line creates a batch (FEFO) when the ingredient has track expiry enabled.",
      "Payment status is derived from paid amount vs total; history shows past receipts.",
    ],
  },
  recipes: {
    title: "Recipes",
    bullets: [
      "Ingredients are deducted per portion when orders hit Preparing (kitchen/POS).",
      "Food cost % turns green under 30%, amber 30–40%, red above 40%.",
      "Yield splits one batch across multiple portions (e.g. 10 burgers per tray).",
    ],
  },
  waste: {
    title: "Waste",
    bullets: [
      "Logs shrink stock and record cost at the time of the write-off.",
      "Totals and the chart group waste by reason for the current branch.",
    ],
  },
  suppliers: {
    title: "Suppliers",
    bullets: [
      "Link suppliers on receive lines to build last-price and reorder suggestions.",
      "Archive suppliers with purchase history instead of deleting them.",
    ],
  },
  movements: {
    title: "Movements ledger",
    bullets: [
      "Append-only audit trail: purchases, sales, waste, adjustments, counts, transfers.",
      "Filter by type, ingredient, or date range. Export is available via browser print/CSV copy.",
    ],
  },
  counts: {
    title: "Physical counts",
    bullets: [
      "Start count snapshots system qty; enter counted qty, submit, then manager approves.",
      "Approval posts COUNT_CORRECTION movements for variances only.",
    ],
  },
  transfers: {
    title: "Branch transfers",
    bullets: [
      "Ship deducts from this branch (IN_TRANSIT); receive adds to the destination branch.",
      "Quantities can be adjusted on receive if the shipment differs.",
    ],
  },
  reports: {
    title: "Reports",
    bullets: [
      "Valuation = on-hand × average cost by category.",
      "Reorder suggestions use par level (or 2× reorder) minus on-hand.",
    ],
  },
};
