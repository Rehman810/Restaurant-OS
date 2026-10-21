"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, UtensilsCrossed, X } from "lucide-react";
import { pkr } from "@/lib/format";
import {
  bandLabel,
  canShowMargin,
  formatCostMoney,
  formatPercent1,
  needsRecipeCheck,
  statusLabel,
} from "@/lib/costing/helpers";
import type { DishCostingRow } from "./types";

const CLOSE_MS = 340;

type DetailPayload = {
  breakdown?: {
    ingredientName: string;
    quantityPerDish: number;
    unit: string;
    unitCost: number | null;
    lineCost: number | null;
    shareOfTotal: number | null;
    costSource: string;
  }[];
  history?: { historyAvailable: boolean };
  row?: DishCostingRow;
  menu?: { id: string; name: string };
  meta?: { targetFoodCostPercent?: number };
};

function ActionLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-center text-xs font-semibold text-stone-800 transition hover:border-brand-200 hover:bg-brand-50/50 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100 dark:hover:border-brand-800"
    >
      {children}
      <ExternalLink size={12} className="shrink-0 opacity-50" aria-hidden />
    </Link>
  );
}

export function DishCostingDetailSheet({
  open,
  onClose,
  row,
  detail,
  currencySymbol,
}: {
  open: boolean;
  onClose: () => void;
  row: DishCostingRow | null;
  detail: DetailPayload | null;
  currencySymbol: string;
}) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    setVisible(false);
    window.setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!open || !row) return;
    setClosing(false);
    document.body.style.overflow = "hidden";
    const r1 = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(r1);
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open, row, close]);

  if (!open || !row) return null;

  const target = detail?.meta?.targetFoodCostPercent ?? 32;
  const flag = statusLabel(row.status);
  const showMargin = canShowMargin(row.status);
  const recipeCheck = needsRecipeCheck(row.status);

  const sheet = (
    <div className="fixed inset-0 z-[100] flex justify-end" aria-hidden={closing}>
      <button
        type="button"
        aria-label="Close dish details"
        onClick={close}
        className={`drawer-backdrop absolute inset-0 bg-stone-950/60 backdrop-blur-[4px] ${
          visible && !closing ? "opacity-100" : "opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Costing for ${row.name}`}
        className={`drawer-panel relative flex h-full w-full max-w-[520px] flex-col rounded-l-2xl bg-white shadow-[-12px_0_48px_rgba(0,0,0,0.2)] dark:bg-stone-900 ${
          visible && !closing ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-1 shrink-0 rounded-tl-2xl bg-brand-600" />

        <header className="shrink-0 border-b border-stone-100 px-5 py-4 dark:border-stone-800 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium text-stone-500">Dish costing</p>
              <h2 className="mt-0.5 flex items-start gap-2 text-xl font-semibold leading-snug text-stone-900 dark:text-stone-50">
                <UtensilsCrossed size={18} className="mt-0.5 shrink-0 text-brand-600" aria-hidden />
                <span className="min-w-0 break-words">{row.name}</span>
              </h2>
              <p className="mt-1 text-sm text-stone-500">
                {row.category}
                {row.type === "COMBO" ? " · Combo" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/40">
              <p className="text-[11px] font-medium text-stone-500">Menu price</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-stone-900 dark:text-stone-50">{pkr(row.price)}</p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/40">
              <p className="text-[11px] font-medium text-stone-500">Recipe cost</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-stone-900 dark:text-stone-50">
                {formatCostMoney(currencySymbol, row.recipeCostDisplay)}
              </p>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/40">
              <p className="text-[11px] font-medium text-stone-500">Margin</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-stone-900 dark:text-stone-50">
                {showMargin ? formatCostMoney(currencySymbol, row.marginAmount) : "—"}
              </p>
              {showMargin && (
                <p className="text-[11px] tabular-nums text-stone-500">{formatPercent1(row.marginPercent)}</p>
              )}
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2.5 dark:border-stone-700 dark:bg-stone-800/40">
              <p className="text-[11px] font-medium text-stone-500">Food cost</p>
              <p className="mt-0.5 text-base font-bold tabular-nums text-stone-900 dark:text-stone-50">
                {row.foodCostPercent != null ? formatPercent1(row.foodCostPercent) : "—"}
              </p>
              {!recipeCheck && (
                <p className="text-[11px] text-stone-500">{bandLabel(row.foodCostBand)}</p>
              )}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {flag && (
            <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              {flag}
              {row.missingIngredients.length ? (
                <span className="mt-1 block text-xs opacity-90">Missing: {row.missingIngredients.join(", ")}</span>
              ) : null}
            </p>
          )}

          {row.suggestedPrice != null && (row.foodCostBand === "WATCH" || row.foodCostBand === "HIGH") && (
            <div className="mb-4 rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-3 text-sm text-brand-950 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-100">
              To reach <strong>{target}%</strong> food cost, price at{" "}
              <strong className="tabular-nums">{formatCostMoney(currencySymbol, row.suggestedPrice)}</strong>
              {row.priceGap != null && row.priceGap > 0 ? (
                <span className="mt-1 block text-xs opacity-90">
                  {formatCostMoney(currencySymbol, row.priceGap)} above current menu price
                </span>
              ) : null}
            </div>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Recipe breakdown</h3>
            {detail?.breakdown?.length ? (
              <div className="mt-2 overflow-hidden rounded-xl border border-stone-200 dark:border-stone-700">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-left text-[11px] font-semibold uppercase tracking-wide text-stone-500 dark:bg-stone-800/80">
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">Ingredient</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                    {detail.breakdown.map((line) => (
                      <tr key={line.ingredientName}>
                        <td className="px-3 py-2.5 pr-2">
                          <p
                            className={
                              line.costSource === "MISSING"
                                ? "font-medium text-amber-800 dark:text-amber-200"
                                : "font-medium text-stone-900 dark:text-stone-100"
                            }
                          >
                            {line.ingredientName}
                          </p>
                          <p className="text-xs text-stone-500">
                            {line.quantityPerDish} {line.unit}
                            {line.shareOfTotal != null ? ` · ${line.shareOfTotal}% of cost` : ""}
                          </p>
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-stone-800 dark:text-stone-200">
                          {formatCostMoney(currencySymbol, line.lineCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-2 rounded-xl border border-dashed border-stone-200 px-3 py-6 text-center text-sm text-stone-500 dark:border-stone-700">
                No recipe lines yet.
              </p>
            )}
          </section>

          {detail?.history && !detail.history.historyAvailable && (
            <p className="mt-3 text-xs text-stone-500">Ingredient price history is not available for this period.</p>
          )}
        </div>

        <footer className="shrink-0 border-t border-stone-100 px-5 py-4 dark:border-stone-800 sm:px-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Quick links</p>
          <div className="grid grid-cols-2 gap-2">
            {row.type === "DISH" && (
              <>
                <ActionLink href={`/admin/inventory?recipe=${row.id}`}>Edit recipe</ActionLink>
                <ActionLink href="/admin/reports/menu-engineering">Menu engineering</ActionLink>
                <ActionLink href="/admin/catalog/dishes">Menu admin</ActionLink>
              </>
            )}
            <ActionLink href="/admin/daily-summary">Daily summary</ActionLink>
          </div>
        </footer>
      </aside>
    </div>
  );

  return createPortal(sheet, document.body);
}
