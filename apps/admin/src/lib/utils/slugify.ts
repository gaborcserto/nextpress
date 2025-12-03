/**
 * Convert a string to a URL-friendly slug.
 * Examples:
 *   "Hello World!" → "hello-world"
 *   "   Multi   space   " → "multi-space"
 */
export function slugify(text: string): string {
  return text
      .toString()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
}
