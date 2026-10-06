/** Check legacy persisted image URLs at the two browser rendering sinks. */
export function safeImageUrl(value: string): string | null {
  if (!value || value !== value.trim() || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    if (value.startsWith("/")) {
      const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
      if (path.startsWith("//") || /[\u0000-\u001f\u007f\\%?#]/.test(path)) return null;
      const url = new URL(value, "https://images.invalid");
      if (url.pathname.startsWith("//")) return null;
      return url.pathname + url.search + url.hash;
    }
    // Require an explicit absolute HTTP(S) URL; never turn bare data into a host.
    if (!/^https?:\/\//i.test(value)) return null;
    const url = new URL(value);
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}
