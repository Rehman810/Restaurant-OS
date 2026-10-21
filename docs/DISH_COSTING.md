# Dish costing

## Cost basis

Theoretical recipe cost per portion uses **branch weighted-average purchase cost** (`BranchStock.avgCost`). When no branch average exists yet, **default ingredient cost** (`InventoryItem.defaultCost`) is used. This matches stock valuation and purchase ledger logic; costing does not change stock or deductions.

## Tax handling

List price uses menu price (or active discount). When **prices include tax** is enabled, margin and food cost % use **net-of-tax** price: `gross / (1 + taxRate/100)` with the store’s default tax rate.

## Data quality status

| Status | Rule |
|--------|------|
| `NO_RECIPE` | No recipe lines on the menu item |
| `INCOMPLETE` | At least one ingredient has no branch avg and no default cost |
| `SUSPICIOUS_LOW` | Complete recipe but cost &lt; `suspiciousLowCostFraction` × category median (default 25%) |
| `COMPLETE` | All ingredients costed and not suspicious |

Incomplete or suspicious items never receive a **healthy** food cost band.

## Food cost bands

From settings (defaults in parentheses):

- **HEALTHY**: food cost % ≤ `foodCostTargetPercent` (32)
- **WATCH**: above target but ≤ `foodCostHighPercent` (40)
- **HIGH**: above high threshold
- **UNKNOWN**: status is not `COMPLETE`

## Suggested price

`suggestedPrice = ceil((recipeCost / (target% / 100)) / step) × step` with `suggestedPriceRoundingStep` default **10**.

`priceGap = suggestedPrice − current list price`.

## Estimated monthly shortfall (summary)

Sum over **WATCH** and **HIGH** dishes with positive `priceGap`:

`(unitsSold in range / rangeDays) × 30 × priceGap`

Labeled as an estimate on the UI.

## Combos

Active deals (not sold out at branch) appear as type **COMBO**. Recipe cost is the sum of component dish recipe costs × `DealItem.quantity`.

## Ingredient price changes

Derived from **PURCHASE** `StockMovement` rows with `unitCost` in the selected window (first half vs second half average). No separate cost history table.

## API

- `GET /admin/reports/dish-costing` — list + summary + pagination (`include=sales` for units/revenue/profit)
- `GET /admin/reports/dish-costing/:id?type=DISH|COMBO` — breakdown + purchase-derived history when available
- `GET /admin/reports/ingredient-price-changes?days=&minPercent=`
- `POST /admin/reports/dish-costing/what-if` — `{ ingredientCostChanges: [{ ingredientId, percentChange | newUnitCost }] }`
- `GET /admin/reports/dish-costing.csv` — UTF-8 BOM, formula-safe cells

**Roles:** `ADMIN` and `MANAGER` only (server-side). Managers are branch-scoped via `branch-scope.ts`.

## Performance

List endpoint batch-loads menu items, recipes, branch stocks, and deals (no per-dish queries). Measure on seeded demo with `time curl` against local API; target &lt; 500 ms.

## E2E

`frontend/e2e/dish-costing.spec.ts` (with `E2E_RUN=1`): admin/manager access, cashier denied, 390px overflow, screenshots under `docs/screenshots/dish-costing/`.

## Manual QA checklist

- [ ] ADMIN: table, summary, detail sheet, CSV export
- [ ] MANAGER: same for assigned branch only
- [ ] CASHIER / WAITER / CHEF: 403 or no nav link
- [ ] Tax inclusive: label “Based on price before tax”; margins use net price
- [ ] Incomplete recipe: “Check recipe”, no healthy band
- [ ] Mobile 390px: no horizontal page scroll; cards + bottom sheet
- [ ] Light and dark theme contrast
