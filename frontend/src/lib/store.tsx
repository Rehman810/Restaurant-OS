"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";
import { api } from "./api";
import { setDisplayCurrency } from "./format";
import { applyBrandTheme } from "./brand-theme";
import { applyDocumentFavicon } from "./apply-document-favicon";
import { PublicStore } from "./types";

const StoreContext = createContext<PublicStore | null>(null);

function applyStoreSideEffects(data: PublicStore) {
  setDisplayCurrency(data.settings);
  const name = data.settings.storeName?.trim();
  const tag = data.settings.storeTagline?.trim();
  if (name) document.title = tag ? `${name} — ${tag}` : name;
  applyBrandTheme(data.settings.primaryColor, data.settings.accentColor);
  const icon = data.settings.faviconUrl?.trim();
  if (icon) applyDocumentFavicon(icon);
}

export function StoreProvider({
  children,
  initialStore = null,
}: {
  children: React.ReactNode;
  initialStore?: PublicStore | null;
}) {
  const [store, setStore] = useState<PublicStore | null>(initialStore);

  useLayoutEffect(() => {
    if (initialStore) applyStoreSideEffects(initialStore);
  }, [initialStore]);

  useEffect(() => {
    function load() {
      api<PublicStore>("/settings/public")
        .then((data) => {
          setStore(data);
          applyStoreSideEffects(data);
        })
        .catch(() => null);
    }
    if (!initialStore) load();
    window.addEventListener("store-refresh", load);
    return () => window.removeEventListener("store-refresh", load);
  }, [initialStore]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
