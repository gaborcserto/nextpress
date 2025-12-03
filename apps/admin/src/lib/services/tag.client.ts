import type { TagValue } from "@/ui/components/TagMultiSelect";

/* ---------- Type guards---------- */

function isTagValue(value: unknown): value is TagValue {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as { [key: string]: unknown };

  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.slug === "string"
  );
}

function isTagValueArray(value: unknown): value is TagValue[] {
  return Array.isArray(value) && value.every(isTagValue);
}

function isPaginatedTagResponse(
  value: unknown
): value is { items: TagValue[] } {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as { [key: string]: unknown };
  const items = obj.items;

  return isTagValueArray(items);
}

/* ---------- loadTagOptionsAction ---------- */

export async function loadTagOptionsAction(
  query: string
): Promise<TagValue[]> {
  const res = await fetch(`/api/tags?query=${encodeURIComponent(query)}`);
  if (!res.ok) return [];

  const raw: unknown = await res.json();

  // 1) { items: TagValue[] }
  if (isPaginatedTagResponse(raw)) {
    return raw.items;
  }

  // 2) TagValue[]
  if (isTagValueArray(raw)) {
    return raw;
  }

  return [];
}

/* ---------- createTagAction ---------- */

export async function createTagAction(label: string): Promise<TagValue> {
  const res = await fetch("/api/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: label }),
  });

  if (!res.ok) {
    throw new Error("Failed to create tag");
  }

  const raw: unknown = await res.json();

  if (isTagValue(raw)) {
    return raw;
  }

  const obj = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  const id =
    typeof obj.id === "string"
      ? obj.id
      : typeof obj.id === "number"
        ? String(obj.id)
        : crypto.randomUUID();

  const name =
    typeof obj.name === "string" && obj.name.trim()
      ? obj.name
      : label;

  const slug =
    typeof obj.slug === "string" && obj.slug.trim()
      ? obj.slug
      : name.toLowerCase().replace(/\s+/g, "-");

  return { id, name, slug };
}
