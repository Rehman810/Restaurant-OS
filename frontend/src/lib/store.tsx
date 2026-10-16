"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";
import { setDisplayCurrency } from "./format";
import { applyBrandTheme } from "./brand-theme";
import { PublicStore } from "./types";

const StoreContext = createContext<PublicStore | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store, setStore] = useState<PublicStore | null>(null);

  useEffect(() => {
    function load() {
      api<PublicStore>("/settings/public")
        .then((data) => {
          setStore(data);
          setDisplayCurrency(data.settings);
          const name = data.settings.storeName?.trim();
          const tag = data.settings.storeTagline?.trim();
          if (name) document.title = tag ? `${name} — ${tag}` : name;
          applyBrandTheme(data.settings.primaryColor, data.settings.accentColor);
          const icon = data.settings.faviconUrl?.trim();
          if (icon) {
            let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
            if (!link) {
              link = document.createElement("link");
              link.rel = "icon";
              document.head.appendChild(link);
            }
            link.href = icon;
          }
        })
        .catch(() => null);
    }
    load();
    window.addEventListener("store-refresh", load);
    return () => window.removeEventListener("store-refresh", load);
  }, []);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
