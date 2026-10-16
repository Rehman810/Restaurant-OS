"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type StorefrontLocale = "en" | "ur";

const STORAGE_KEY = "storefront_locale";

const messages: Record<StorefrontLocale, Record<string, string>> = {
  en: {
    nav_home: "Home",
    nav_menu: "Menu",
    nav_orders: "Orders",
    nav_track: "Track order",
    track_title: "Track your order",
    track_subtitle: "Enter your order number and phone — no account needed.",
    install_app: "Install app",
    install_dismiss: "Not now",
    feedback_title: "How was your order?",
    feedback_submit: "Send feedback",
    feedback_thanks: "Thanks for your feedback!",
    push_enable: "Get status alerts",
    push_enabled: "Notifications on",
    push_denied: "Notifications blocked in browser settings.",
    order_cancelled: "This order was cancelled.",
  },
  ur: {
    nav_home: "ہوم",
    nav_menu: "مینو",
    nav_orders: "آرڈرز",
    nav_track: "آرڈر ٹریک کریں",
    track_title: "اپنا آرڈر ٹریک کریں",
    track_subtitle: "آرڈر نمبر اور فون درج کریں — اکاؤنٹ کی ضرورت نہیں۔",
    install_app: "ایپ انسٹال کریں",
    install_dismiss: "ابھی نہیں",
    feedback_title: "آرڈر کیسا تھا؟",
    feedback_submit: "رائے بھیجیں",
    feedback_thanks: "آپ کی رائے کا شکریہ!",
    push_enable: "اسٹیٹس کی اطلاعیں",
    push_enabled: "اطلاعات آن",
    push_denied: "براؤزر میں اطلاعات بند ہیں۔",
    order_cancelled: "یہ آرڈر منسوخ ہو گیا۔",
  },
};

type Ctx = {
  locale: StorefrontLocale;
  setLocale: (l: StorefrontLocale) => void;
  t: (key: string) => string;
};

const LocaleContext = createContext<Ctx | null>(null);

export function StorefrontLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<StorefrontLocale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ur" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = useCallback((l: StorefrontLocale) => {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l === "ur" ? "ur" : "en";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "ur" ? "ur" : "en";
  }, [locale]);

  const t = useCallback((key: string) => messages[locale][key] ?? messages.en[key] ?? key, [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useStorefrontLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "en" as StorefrontLocale,
      setLocale: () => undefined,
      t: (key: string) => messages.en[key] ?? key,
    };
  }
  return ctx;
}
