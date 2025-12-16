import { slugify } from "@/lib/utils";
import { EMPTY_SLATE_VALUE } from "@/ui/components/SlateEditor";
import type { Descendant } from "slate";

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

export type SlateLike = Descendant[] | string | null | undefined;

type SlateText = { text: string };
type SlateElementLike = { type?: string; children: unknown[]; [k: string]: unknown };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isSlateText(v: unknown): v is SlateText {
  return isObject(v) && typeof v.text === "string";
}

function isSlateElementLike(v: unknown): v is SlateElementLike {
  return isObject(v) && Array.isArray(v.children);
}

function ensureNonEmptyChildren(children: unknown[]): unknown[] {
  return children.length === 0 ? [{ text: "" }] : children;
}

function sanitizeDescendant(node: unknown): Descendant {
  if (isSlateText(node)) {
    return node as Descendant;
  }

  if (isSlateElementLike(node)) {
    const children = ensureNonEmptyChildren(node.children).map(sanitizeDescendant);

    // keep other props (type, align, level, etc.)
    const out: Record<string, unknown> = { ...node, children };
    return out as Descendant;
  }

  // fallback for invalid nodes
  return { text: "" } as Descendant;
}

function sanitizeValue(value: unknown): Descendant[] {
  if (!Array.isArray(value) || value.length === 0) {
    return EMPTY_SLATE_VALUE;
  }

  const sanitized = value.map(sanitizeDescendant);

  // Top-level should be elements. If a text sneaks in, wrap it into a paragraph.
  return sanitized.map((n) => {
    if (isSlateText(n)) {
      return { type: "paragraph", children: [n] } as Descendant;
    }
    return n;
  });
}

/**
 * Accepts: Descendant[] | string | null | undefined
 * Returns: always Descendant[] and ensures every element has at least one text leaf.
 */
export function normalizeSlateValue(input: SlateLike): Descendant[] {
  if (Array.isArray(input)) {
    return sanitizeValue(input);
  }

  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return EMPTY_SLATE_VALUE;

    return sanitizeValue([
      {
        type: "paragraph",
        children: [{ text }],
      },
    ]);
  }

  return EMPTY_SLATE_VALUE;
}
