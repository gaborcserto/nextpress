export function isMediaBrowseKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    (key.startsWith("/api/documents?") || key.startsWith("/api/media/library?"))
  );
}
