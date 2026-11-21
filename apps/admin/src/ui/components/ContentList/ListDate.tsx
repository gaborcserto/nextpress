import { AdminTimestamp } from "@/lib/settings/admin-date-time";

export default function ListDate({ value }: { value?: string | null }) {
  if (!value) {
    return <span aria-label="No date">?</span>;
  }

  return <AdminTimestamp value={value} />;
}
