"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useStorefrontLocale } from "@/lib/i18n/storefront";

const DISMISS_KEY = "pwa_install_dismissed";

export function InstallAppBanner() {
  const { t } = useStorefrontLocale();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || !deferred) return null;

  return (
    <div className="border-b border-brand-200 bg-brand-50 px-4 py-2.5 text-center text-sm text-brand-950">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2">
        <Download size={16} className="shrink-0" />
        <span className="font-medium">Add to home screen for faster ordering.</span>
        <button
          type="button"
          className="rounded-full bg-brand-600 px-3 py-1 text-xs font-bold text-white"
          onClick={() => {
            void deferred.prompt();
            void deferred.userChoice.then(() => setHidden(true));
          }}
        >
          {t("install_app")}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-800"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setHidden(true);
          }}
        >
          <X size={14} /> {t("install_dismiss")}
        </button>
      </div>
    </div>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
