import type { TagValue } from "@/ui/components/TagMultiSelect";

/* ---------- Type guards ---------- */

/**
 * Runtime type guard for a single TagValue.
 */
function isTagValue(value: unknown): value is TagValue {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as { [key: string]: unknown };

  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.slug === "string"
  );
}

/**
 * Runtime type guard for an array of TagValue.
 */
function isTagValueArray(value: unknown): value is TagValue[] {
  return Array.isArray(value) && value.every(isTagValue);
}

/**
 * Runtime type guard for paginated tag responses.
 * Expected shape: { items: TagValue[] }
 */
function isPaginatedTagResponse(
  value: unknown
): value is { items: TagValue[] } {
  if (typeof value !== "object" || value === null) return false;

  const obj = value as { [key: string]: unknown };
  const items = obj.items;

  return isTagValueArray(items);
}

/**
 * Many endpoints in this codebase use helpers like `ok(...)`
 * which may wrap the payload as `{ data: ... }`.
 *
 * This helper normalizes both wrapped and unwrapped responses.
 */
function unwrapOkData(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;

  const obj = raw as Record<string, unknown>;
  return "data" in obj ? obj.data : raw;
}

/* ---------- Tag option loading ---------- */

/**
 * Load tag options for autocomplete / multiselect fields.
 * Used by TagMultiSelect during search.
 */
export async function loadTagOptionsAction(
  query: string
): Promise<TagValue[]> {
  const res = await fetch(`/api/tags?query=${encodeURIComponent(query)}`);
  if (!res.ok) return [];

  const raw: unknown = await res.json();
  const unwrapped = unwrapOkData(raw);

  if (isPaginatedTagResponse(unwrapped)) {
    return unwrapped.items;
  }

  if (isTagValueArray(unwrapped)) {
    return unwrapped;
  }

  return [];
}

/* ---------- Tag creation ---------- */

/**
 * Create a new tag by name.
 * If a tag with the same name already exists, the API may return it instead.
 */
export async function createTagAction(
  label: string
): Promise<TagValue> {
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

  /**
   * Defensive fallback in case the API returns
   * a partially malformed or unexpected payload.
   */
  const obj =
    (typeof unwrapped === "object" && unwrapped !== null
      ? unwrapped
      : {}) as Record<string, unknown>;

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

/* ---------- Entity tag linking ---------- */

/**
 * Load tags assigned to a specific entity (Page or Post).
 */
export async function loadEntityTagsAction(
  entityId: string
): Promise<TagValue[]> {
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
 * Replace all tags assigned to an entity (Page or Post).
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

/* ---------- Admin tag listing ---------- */

/**
 * Tag value extended with usage count.
 * `usedCount` represents how many pages/posts reference the tag.
 */
export type TagWithUsageValue = TagValue & { usedCount: number };

/**
 * Runtime type guard for TagWithUsageValue.
 */
function isTagWithUsageValue(
  value: unknown
): value is TagWithUsageValue {
  if (!isTagValue(value)) return false;

  const obj = value as Record<string, unknown>;
  return typeof obj.usedCount === "number";
}

/**
 * Runtime type guard for arrays of TagWithUsageValue.
 */
function isTagWithUsageArray(
  value: unknown
): value is TagWithUsageValue[] {
  return Array.isArray(value) && value.every(isTagWithUsageValue);
}

/**
 * Load all tags for the admin taxonomy screen,
 * including usage counts.
 */
export async function loadTagsAdminAction(): Promise<TagWithUsageValue[]> {
  const res = await fetch("/api/admin/tags", { cache: "no-store" });
  if (!res.ok) return [];

  const raw: unknown = await res.json();
  const unwrapped = unwrapOkData(raw);

  if (isTagWithUsageArray(unwrapped)) return unwrapped;

  const obj =
    (typeof unwrapped === "object" && unwrapped !== null
      ? unwrapped
      : {}) as Record<string, unknown>;

  if (isTagWithUsageArray(obj.items)) return obj.items;

  return [];
}

/**
 * Delete a tag by ID from the admin interface.
 * This also removes the tag from all linked pages/posts.
 */
export async function deleteTagAdminAction(
  id: string
): Promise<void> {
  const res = await fetch(
    `/api/admin/tags/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    throw new Error("Failed to delete tag");
  }
}

