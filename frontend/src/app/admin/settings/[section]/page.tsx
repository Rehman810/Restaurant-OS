"use client";

import { notFound } from "next/navigation";
import { AdminSettingsWorkspace } from "@/components/admin/settings/AdminSettingsWorkspace";
import { isSettingsSectionId } from "@/modules/settings/ia";

export default function AdminSettingsSectionPage({ params }: { params: { section: string } }) {
  const { section } = params;
  if (!isSettingsSectionId(section)) {
    notFound();
  }
  return <AdminSettingsWorkspace section={section} />;
}
