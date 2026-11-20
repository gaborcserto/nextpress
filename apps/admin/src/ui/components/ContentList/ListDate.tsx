export default function ListDate({ value }: { value?: string | null }) {
  if (!value) {
    return <span aria-label="No date">?</span>;
  }

  return <time dateTime={value}>{new Date(value).toLocaleString()}</time>;
}
