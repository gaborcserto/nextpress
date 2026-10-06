const DEFAULT_CALLBACK = "/admin";
const LOCAL_ORIGIN = "https://navigation.invalid";

export function safeCallbackUrl(raw?: string | null): string {
  if (!raw || /[\u0000-\u001f\u007f\\]/.test(raw) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(raw)) {
    return DEFAULT_CALLBACK;
  }
  try {
    const trimmed = raw.trim();
    const boundary = trimmed.search(/[?#]/);
    const path = boundary < 0 ? trimmed : trimmed.slice(0, boundary);
    const suffix = boundary < 0 ? "" : trimmed.slice(boundary);
    // Validate escape syntax without decoding the destination's query or hash.
    decodeURIComponent(suffix);
    // Decode the path once; preserve query/hash escapes for the destination.
    // Reject residual path escapes rather than making another decoding decision.
    const decoded = decodeURIComponent(path);
    if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\u0000-\u001f\u007f\\%?#]/.test(decoded)) {
      return DEFAULT_CALLBACK;
    }
    const url = new URL(decoded + suffix, LOCAL_ORIGIN);
    // URL parsing normalizes dot segments before checking the route boundary.
    if (url.origin !== LOCAL_ORIGIN ||
      !(url.pathname === "/" || url.pathname === "/admin" || url.pathname.startsWith("/admin/"))) {
      return DEFAULT_CALLBACK;
    }
    return url.pathname + url.search + url.hash;
  } catch {
    return DEFAULT_CALLBACK;
  }
}
