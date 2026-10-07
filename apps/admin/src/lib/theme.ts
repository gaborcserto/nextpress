/** An absent cookie leaves DaisyUI's OS preference in control. */
export function normalizeThemeCookie(value: unknown): "light" | "dark" | undefined {
  if (value === undefined) return undefined;
  if (value === "light" || value === "dark") return value;
  return "light";
}
