import { slugify } from "@/lib/utils";

/**
 * Build initial form values.
 * - If slug is empty AND title exists → generate slug from title.
 */
export function buildInitialForm<T extends { slug: string; title: string }>(
  initial: T
): T {
  if (!initial.slug && initial.title) {
    return { ...initial, slug: slugify(initial.title) };
  }
  return initial;
}

/**
 * Safely extract an entity id from an unknown value.
 * Keeps form value types clean (no `id` pollution).
 */
export function getEntityId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  const obj = value as Record<string, unknown>;
  const id = obj.id;

  return typeof id === "string" && id.trim() ? id : undefined;
}
