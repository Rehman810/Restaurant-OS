"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { subscribeToOrderPush } from "@/lib/push-subscribe";
import { useStore } from "@/lib/store";
import { useStorefrontLocale } from "@/lib/i18n/storefront";

export function OrderPushPrompt({ orderId }: { orderId: string }) {
  const store = useStore();
  const { t } = useStorefrontLocale();
  const [state, setState] = useState<"idle" | "on" | "err">("idle");
  const [msg, setMsg] = useState("");

  if (!store?.settings.storefrontPushEnabled) return null;
  if (state === "on") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-700">
        <Bell size={16} /> {t("push_enabled")}
      </p>
    );
  }

  return (
    <div className="text-center">
      <button
        type="button"
        className="btn-ghost inline-flex h-11 items-center gap-2"
        onClick={() => {
          void subscribeToOrderPush(orderId)
            .then(() => setState("on"))
            .catch((err) => {
              setState("err");
              setMsg(err instanceof Error ? err.message : t("push_denied"));
            });
        }}
      >
        <Bell size={16} /> {t("push_enable")}
      </button>
      {state === "err" && msg && <p className="mt-2 text-xs text-amber-800">{msg}</p>}
    </div>
  );
}
