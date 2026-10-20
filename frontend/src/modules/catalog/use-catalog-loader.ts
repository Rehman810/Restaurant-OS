"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { enrichCategories } from "@/lib/category-meta";
import { mergeDealCategoryOptions } from "@/lib/deal-categories";
import { fetchAllCategories, fetchAllDeals, fetchAllMenuItems } from "@/lib/catalog-api";
import { fetchPrintStations, type PrintStation } from "@/lib/admin-print-stations";
import { CATEGORIES as DEFAULT_CATEGORIES, Category, Deal, MenuItem } from "@/lib/types";

export function useCatalogLoader() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [printStations, setPrintStations] = useState<PrintStation[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setLoadError("");
    try {
      const [menu, dealList, cats, stationsRes] = await Promise.all([
        fetchAllMenuItems(),
        fetchAllDeals(),
        fetchAllCategories().catch(() => []),
        fetchPrintStations().catch(() => ({ stations: [] as PrintStation[] })),
      ]);
      setItems(menu);
      setDeals(dealList);
      setCategories(enrichCategories(cats));
      setPrintStations(stationsRes.stations);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load catalog.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const categoryNames = useMemo(
    () => (categories.length > 0 ? categories.map((c) => c.name) : [...DEFAULT_CATEGORIES]),
    [categories]
  );

  const dealCategoryOptions = useMemo(
    () => mergeDealCategoryOptions(deals.map((d) => d.category)),
    [deals]
  );

  return {
    items,
    printStations,
    deals,
    categories,
    categoryNames,
    dealCategoryOptions,
    loading,
    refreshing,
    loadError,
    load,
  };
}
