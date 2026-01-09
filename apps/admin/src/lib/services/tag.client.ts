import type { TagValue } from "@/ui/components/TagMultiSelect";

/* ---------- Type guards ---------- */

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

function isPaginatedTagResponse(value: unknown): value is { items: TagValue[] } {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as { [key: string]: unknown };
  const items = obj.items;

  return isTagValueArray(items);
}

/**
 * Many endpoints in this codebase use helpers like `ok(...)`,
 * which may wrap the payload as `{ data: ... }`.
 * This helper lets us gracefully handle both wrapped and unwrapped responses.
 */
function unwrapOkData(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;

  const obj = raw as Record<string, unknown>;
  return "data" in obj ? obj.data : raw;
}

/* ---------- loadTagOptionsAction ---------- */

export async function loadTagOptionsAction(query: string): Promise<TagValue[]> {
  const res = await fetch(`/api/tags?query=${encodeURIComponent(query)}`);
  if (!res.ok) return [];

  const raw: unknown = await res.json();
  const unwrapped = unwrapOkData(raw);

  // 1) { items: TagValue[] }
  if (isPaginatedTagResponse(unwrapped)) {
    return unwrapped.items;
  }

  // 2) TagValue[]
  if (isTagValueArray(unwrapped)) {
    return unwrapped;
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
  const unwrapped = unwrapOkData(raw);

  if (isTagValue(unwrapped)) {
    return unwrapped;
  }

  const obj =
    (typeof unwrapped === "object" && unwrapped !== null ? unwrapped : {}) as Record<
      string,
      unknown
    >;

  const id =
    typeof obj.id === "string"
      ? obj.id
      : typeof obj.id === "number"
        ? String(obj.id)
        : crypto.randomUUID();

  const name = typeof obj.name === "string" && obj.name.trim() ? obj.name : label;

  const slug =
    typeof obj.slug === "string" && obj.slug.trim()
      ? obj.slug
      : name.toLowerCase().replace(/\s+/g, "-");

  return { id, name, slug };
}

/* ---------- Entity tags (load + persist) ---------- */

/**
 * Load tags assigned to an entity (Page/Post) by ID.
 */
export async function loadEntityTagsAction(entityId: string): Promise<TagValue[]> {
  const res = await fetch(
    `/api/tags/link?entityId=${encodeURIComponent(entityId)}`
  );
  if (!res.ok) return [];

  const raw: unknown = await res.json();
  const unwrapped = unwrapOkData(raw);

  if (isTagValueArray(unwrapped)) return unwrapped;

  return [];
}

/**
 * Replace all tags assigned to an entity (Page/Post) by ID.
 */
export async function updateEntityTagsAction(
  entityId: string,
  tagIds: string[]
): Promise<void> {
  await fetch(`/api/tags/link?entityId=${encodeURIComponent(entityId)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tagIds }),
  });
}

export type TagWithUsageValue = TagValue & { usedCount: number };

function isTagWithUsageValue(value: unknown): value is TagWithUsageValue {
  if (!isTagValue(value)) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.usedCount === "number";
}

function isTagWithUsageArray(value: unknown): value is TagWithUsageValue[] {
  return Array.isArray(value) && value.every(isTagWithUsageValue);
}

export async function loadTagsAdminAction(): Promise<TagWithUsageValue[]> {
  const res = await fetch("/api/admin/tags", { cache: "no-store" });
  if (!res.ok) return [];

  const raw: unknown = await res.json();
  const unwrapped = unwrapOkData(raw);

  if (isTagWithUsageArray(unwrapped)) return unwrapped;

  const obj =
    (typeof unwrapped === "object" && unwrapped !== null ? unwrapped : {}) as Record<
      string,
      unknown
    >;

  if (isTagWithUsageArray(obj.items)) return obj.items;

  return [];
}

export async function deleteTagAdminAction(id: string): Promise<void> {
  const res = await fetch(`/api/admin/tags/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to delete tag");
  }
}
