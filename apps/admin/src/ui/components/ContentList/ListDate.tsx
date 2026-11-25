import { useAdminTimestampFormatter } from "@/lib/settings/admin-date-time";

export default function ListDate({ value }: { value?: string | null }) {
  const formatTimestamp = useAdminTimestampFormatter();

  if (!value) {
    return <span aria-label="No date">?</span>;
  }

  const timestamp = formatTimestamp(value);
  // The formatter appends localized time after the final comma-space separator.
  const separator = timestamp.lastIndexOf(", ");

  return (
    <time dateTime={value} className="admin-list-date">
      {separator < 0 ? (
        timestamp
      ) : (
        <>
          <span>{timestamp.slice(0, separator + 1)}</span>{" "}
          <span>{timestamp.slice(separator + 2)}</span>
        </>
      )}
    </time>
  );
}
