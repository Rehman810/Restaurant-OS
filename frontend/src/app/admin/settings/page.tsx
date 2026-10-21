"use client";

import { SettingsPageHeader } from "@/components/admin/settings/SettingsPageHeader";
import { SettingsMobileSectionList } from "@/components/admin/settings/SettingsMobileSectionList";

/** Mobile: section list. Desktop nav lives in the sidebar; shell redirects wide viewports to the default section. */
export default function AdminSettingsIndexPage() {
  return (
    <div className="max-lg:block lg:hidden">
      <SettingsPageHeader
        title="Settings"
        description="Choose a section to update your restaurant."
      />
      <SettingsMobileSectionList />
    </div>
  );
}
