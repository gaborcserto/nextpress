import { SettingsScreen } from "@/features/settings/SettingsScreen";

export default function AdminSettingsPage() {
  const timeZones = ["UTC", ...(Intl.supportedValuesOf?.("timeZone") ?? [])];

  return <SettingsScreen timeZones={timeZones} />;
}
