const ALLOWED_PREFIXES = ["/admin", "/"];

export function safeCallbackUrl(raw?: string | null): string {
  const DEFAULT = "/admin";

  if (!raw) return DEFAULT;

  try {
    const trimmed = raw.trim();

    if (/^https?:\/\//i.test(trimmed)) return DEFAULT;

    const decoded = decodeURIComponent(trimmed);

    const isAllowed =
        ALLOWED_PREFIXES.includes(decoded) ||
        ALLOWED_PREFIXES.some(p => decoded.startsWith(p + "/"));

    return isAllowed ? decoded : DEFAULT;
  } catch {
    return DEFAULT;
  }
}
