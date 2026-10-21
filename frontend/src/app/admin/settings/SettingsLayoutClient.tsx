"use client";

import { Suspense } from "react";
import { SettingsShell } from "@/components/admin/settings/SettingsShell";
import { AdminPage } from "@/components/admin/ui/AdminPage";

export function SettingsLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <AdminPage className="!space-y-0">
      <Suspense
        fallback={
          <div className="space-y-4">
            <div className="skeleton h-10 rounded-2xl" />
            <div className="skeleton h-64 rounded-2xl" />
          </div>
        }
      >
        <SettingsShell>{children}</SettingsShell>
      </Suspense>
    </AdminPage>
  );
}
