"use client";

import { FormEvent, useState } from "react";
import { Star } from "lucide-react";
import { api } from "@/lib/api";
import { orderFeedbackPath } from "@/lib/guest-order";
import { useStorefrontLocale } from "@/lib/i18n/storefront";

export function OrderFeedbackForm({
  orderId,
  guestToken,
  onSubmitted,
}: {
  orderId: string;
  guestToken: string | null;
  onSubmitted: () => void;
}) {
  const { t } = useStorefrontLocale();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(orderFeedbackPath(orderId, guestToken), {
        method: "POST",
        body: JSON.stringify({ rating, comment }),
      });
      setDone(true);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send feedback.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
        {t("feedback_thanks")}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-orange-100 bg-white p-5">
      <p className="font-display text-lg text-stone-900">{t("feedback_title")}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className="rounded-lg p-1"
            onClick={() => setRating(n)}
            aria-label={`${n} stars`}
          >
            <Star size={28} className={n <= rating ? "fill-amber-400 text-amber-500" : "text-stone-300"} />
          </button>
        ))}
      </div>
      <textarea
        className="input min-h-[80px]"
        placeholder="Optional comment"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary h-11 w-full" disabled={busy}>
        {busy ? "Sending…" : t("feedback_submit")}
      </button>
    </form>
  );
}
