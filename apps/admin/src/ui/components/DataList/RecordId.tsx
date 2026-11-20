export default function RecordId({ id }: { id: string }) {
  return (
    <details className="text-xs text-(--text-muted)">
      <summary className="cursor-pointer">ID</summary>
      <input
        aria-label="Record ID"
        className="w-full max-w-40 font-mono"
        value={id}
        readOnly
        onFocus={(event) => event.currentTarget.select()}
      />
    </details>
  );
}
