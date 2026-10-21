import { SettingsLayoutClient } from "./SettingsLayoutClient";

export const dynamic = "force-dynamic";

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayoutClient>{children}</SettingsLayoutClient>;
}
