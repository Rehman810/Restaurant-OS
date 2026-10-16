"use client";

import { useEffect, useState } from "react";
import { UtensilsCrossed } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { pkr } from "@/lib/format";
import { AdminEmptyState, AdminPage, AdminPageHeader } from "@/components/admin/ui";

type Dish = {
  menuItemId: string;
  name: string;
  category: string;
  price: number;
  costStatus: string;
  recipeCost: number | null;
  foodCostPercent: number | null;
  marginPercent: number | null;
  missingRecipe: boolean;
};

export default function DishCostingPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [basis, setBasis] = useState("");

  useEffect(() => {
    if (!allowed) return;
    void api<{ dishes: Dish[]; costBasis: string }>("/admin/reports/dish-costing").then((d) => {
      setDishes(d.dishes);
      setBasis(d.costBasis);
    });
  }, [allowed]);

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Dish costing" description="Manager access required." />
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Dish costing" description={basis || "Theoretical recipe cost vs menu price."} />
      {dishes.length === 0 ? (
        <AdminEmptyState icon={UtensilsCrossed} title="No menu items" description="Add menu items and recipes in Inventory." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-700">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase text-stone-500 dark:bg-stone-800">
              <tr>
                <th className="p-3">Dish</th>
                <th className="p-3">Price</th>
                <th className="p-3">Recipe cost</th>
                <th className="p-3">Food cost %</th>
                <th className="p-3">Margin %</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((d) => (
                <tr key={d.menuItemId} className="border-t border-stone-100 dark:border-stone-800">
                  <td className="p-3">
                    <p className="font-semibold">{d.name}</p>
                    <p className="text-xs text-stone-500">{d.category}</p>
                  </td>
                  <td className="p-3 tabular-nums">{pkr(d.price)}</td>
                  <td className="p-3 tabular-nums">
                    {d.missingRecipe || d.costStatus !== "ok" ? (
                      <span className="text-amber-700">Cost unknown</span>
                    ) : (
                      pkr(d.recipeCost!)
                    )}
                  </td>
                  <td className="p-3 tabular-nums">{d.foodCostPercent != null ? `${d.foodCostPercent}%` : "—"}</td>
                  <td className="p-3 tabular-nums">{d.marginPercent != null ? `${d.marginPercent}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminPage>
  );
}
