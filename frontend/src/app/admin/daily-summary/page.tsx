"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, ApiError, getApiUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { AdminPage, AdminPageHeader } from "@/components/admin/ui";
import { DailySummaryView } from "@/modules/daily-summary/DailySummaryView";
import type { DailySummaryPayload } from "@/modules/daily-summary/types";
import { compareParam, todayDateKeyInTz, type CompareMode } from "@/modules/daily-summary/helpers";

export default function DailySummaryPage() {
  const { user } = useAuth();
  const allowed = user?.role === "ADMIN" || user?.role === "MANAGER";
  const router = useRouter();
  const searchParams = useSearchParams();

  const [data, setData] = useState<DailySummaryPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const timezone = data?.meta.timezone ?? "Asia/Karachi";
  const dateKey = searchParams.get("date") ?? todayDateKeyInTz(timezone);
  const compareMode = (searchParams.get("compare") as CompareMode) || "yesterday";

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    q.set("date", dateKey);
    q.set("compare", compareParam(compareMode));
    try {
      const res = await api<DailySummaryPayload>(`/admin/daily-summary?${q}`);
      setData(res);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [allowed, dateKey, compareMode]);

  useEffect(() => {
    void load();
  }, [load]);

  const updatedLabel = useMemo(() => {
    if (!updatedAt) return "";
    return `Updated ${new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(updatedAt)}`;
  }, [updatedAt, timezone]);

  function setQuery(patch: Record<string, string>) {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) q.set(k, v);
    router.replace(`/admin/daily-summary?${q.toString()}`);
  }

  if (!allowed) {
    return (
      <AdminPage>
        <AdminPageHeader title="Daily summary" description="Manager access required." />
      </AdminPage>
    );
  }

  return (
    <>
    {emailMsg && <p className="mb-2 text-sm text-stone-600 print:hidden">{emailMsg}</p>}
    <DailySummaryView
      data={data}
      loading={loading}
      error={error}
      onRetry={() => void load()}
      dateKey={dateKey}
      timezone={timezone}
      compareMode={compareMode}
      onCompareMode={(m) => setQuery({ compare: m })}
      onDateChange={(d) => setQuery({ date: d })}
      onRefresh={() => void load()}
      updatedLabel={updatedLabel}
      onPrint={() => window.print()}
      onExport={() => {
        const q = new URLSearchParams();
        q.set("date", dateKey);
        q.set("compare", compareParam(compareMode));
        window.open(`${getApiUrl()}/admin/daily-summary/export.csv?${q}`, "_blank");
      }}
      onSendEmail={() => {
        setEmailMsg(null);
        void api("/admin/daily-summary/email/test", { method: "POST" })
          .then(() => setEmailMsg("Test close-out email sent (if SMTP is configured)."))
          .catch((e) => setEmailMsg(e instanceof ApiError ? e.message : "Could not send email"));
      }}
    />
    </>
  );
}
