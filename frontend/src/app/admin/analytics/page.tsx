"use client";

import { Suspense } from "react";
import { AdminAnalyticsView } from "@/components/admin/analytics/AdminAnalyticsView";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<div className="skeleton mx-auto mt-8 h-64 max-w-4xl rounded-2xl" />}>
      <AdminAnalyticsView />
    </Suspense>
  );
}
