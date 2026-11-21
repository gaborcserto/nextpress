import { SettingsScreen } from "@/components/admin/SettingsScreen";

export default function AdminSettingsPage() {
  const timeZones = ["UTC", ...(Intl.supportedValuesOf?.("timeZone") ?? [])];

  return <SettingsScreen timeZones={timeZones} />;
}
