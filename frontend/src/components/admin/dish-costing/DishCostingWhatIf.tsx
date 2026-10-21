"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { fetchInventoryItems } from "@/modules/inventory/api";
import { SearchField, Segment, SelectField, TextInput } from "@/components/admin/ui";
import { bandLabel, formatCostMoney, formatPercent1 } from "@/lib/costing/helpers";
import type { FoodCostBand } from "@/lib/costing/helpers";

type Impact = {
  id: string;
  name: string;
  before: { recipeCost: number | null; marginPercent: number | null; band: FoodCostBand };
  after: { recipeCost: number | null; marginPercent: number | null; band: FoodCostBand };
  bandChanged: boolean;
};

function isKitchenIngredient(name: string) {
  const n = name.toLowerCase();
  if (n.includes("audit") || n.includes("rollback") || n.startsWith("test ")) return false;
  return true;
}

export function DishCostingWhatIf({
  open,
  onClose,
  currencySymbol,
  targetFoodCostPercent = 32,
}: {
  open: boolean;
  onClose: () => void;
  currencySymbol: string;
  targetFoodCostPercent?: number;
}) {
  const [rawItems, setRawItems] = useState<{ id: string; name: string; unit?: string }[]>([]);
  const [ingredientId, setIngredientId] = useState("");
  const [ingredientSearch, setIngredientSearch] = useState("");
  const [mode, setMode] = useState<"percent" | "cost">("percent");
  const [percent, setPercent] = useState("10");
  const [unitCost, setUnitCost] = useState("");
  const [loading, setLoading] = useState(false);
  const [impacts, setImpacts] = useState<Impact[]>([]);
  const [error, setError] = useState("");
  const [ran, setRan] = useState(false);

  const ingredients = useMemo(
    () =>
      rawItems
        .filter((i) => isKitchenIngredient(i.name))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [rawItems]
  );

  const ingredientOptions = useMemo(() => {
    const s = ingredientSearch.trim().toLowerCase();
    const list = s ? ingredients.filter((i) => i.name.toLowerCase().includes(s)) : ingredients;
    return list.slice(0, 80).map((i) => ({
      value: i.id,
      label: i.unit ? `${i.name} (${i.unit})` : i.name,
    }));
  }, [ingredients, ingredientSearch]);

  useEffect(() => {
    if (!open) return;
    setImpacts([]);
    setRan(false);
    setError("");
    setIngredientId("");
    setIngredientSearch("");
    void fetchInventoryItems({ limit: "500" }).then((d) => {
      setRawItems(d.items.map((i) => ({ id: i.id, name: i.name, unit: i.unit })));
    });
  }, [open]);

  async function run() {
    if (!ingredientId) return;
    setLoading(true);
    setError("");
    setRan(false);
    try {
      const change =
        mode === "percent"
          ? { ingredientId, percentChange: Number(percent) }
          : { ingredientId, newUnitCost: Number(unitCost) };
      const res = await api<{ impacts: Impact[] }>("/admin/reports/dish-costing/what-if", {
        method: "POST",
        body: JSON.stringify({ ingredientCostChanges: [change] }),
      });
      setImpacts(res.impacts.filter((i) => i.bandChanged));
      setRan(true);
    } catch {
      setError("Could not run scenario.");
      setImpacts([]);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal
      aria-labelledby="what-if-title"
    >
      <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-xl dark:bg-stone-900 sm:rounded-2xl safe-area-pb">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-700">
          <h2 id="what-if-title" className="font-display text-lg font-bold text-stone-900 dark:text-stone-50">
            What if?
          </h2>
          <button
            type="button"
            className="grid h-11 w-11 place-items-center rounded-full hover:bg-stone-100 dark:hover:bg-stone-800"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto p-4">
          <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            Simulate an ingredient price change. We recalculate each dish&apos;s recipe cost and show only dishes whose{" "}
            target status would change. Nothing is saved.
          </p>

          <SearchField
            value={ingredientSearch}
            onChange={setIngredientSearch}
            placeholder="Search ingredient name…"
            aria-label="Search ingredient name"
          />
          <SelectField
            label="Ingredient"
            value={ingredientId}
            onChange={setIngredientId}
            options={[{ value: "", label: "Choose ingredient…" }, ...ingredientOptions]}
            placeholder="Choose ingredient…"
          />
          {ingredientSearch && ingredientOptions.length === 0 && (
            <p className="text-xs text-stone-500">No ingredients match. Try another name.</p>
          )}

          <Segment
            value={mode}
            onChange={setMode}
            fullWidth
            options={[
              { id: "percent", label: "% change" },
              { id: "cost", label: "New unit cost" },
            ]}
          />

          {mode === "percent" ? (
            <label className="block text-sm">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">Percent change</span>
              <TextInput
                className="mt-1"
                type="number"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                placeholder="e.g. 14 for +14%"
              />
            </label>
          ) : (
            <label className="block text-sm">
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-400">New cost per unit</span>
              <TextInput
                className="mt-1"
                type="number"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="Per purchase unit"
              />
            </label>
          )}

          <button
            type="button"
            className="btn-primary min-h-11 w-full"
            disabled={loading || !ingredientId}
            onClick={() => void run()}
          >
            {loading ? "Calculating…" : "Show affected dishes"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {ran && impacts.length === 0 && !error && (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:bg-stone-800/50 dark:text-stone-400">
              No dishes would change target status at your {targetFoodCostPercent}% food cost targets.
            </p>
          )}

          <ul className="space-y-3">
            {impacts.map((row) => (
              <li key={row.id} className="rounded-xl border border-stone-200 p-3 text-sm dark:border-stone-700">
                <p className="font-semibold text-stone-900 dark:text-stone-50">{row.name}</p>
                <p className="mt-1 text-stone-600 dark:text-stone-400">
                  Recipe cost {formatCostMoney(currencySymbol, row.before.recipeCost)} →{" "}
                  {formatCostMoney(currencySymbol, row.after.recipeCost)}
                </p>
                <p className="text-stone-600 dark:text-stone-400">
                  Margin {formatPercent1(row.before.marginPercent)} → {formatPercent1(row.after.marginPercent)}
                </p>
                <p>
                  Status {bandLabel(row.before.band)} → <strong>{bandLabel(row.after.band)}</strong>
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
