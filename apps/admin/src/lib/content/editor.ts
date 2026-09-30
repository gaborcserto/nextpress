import { slugify } from "@/lib/utils";
import type { Descendant } from "slate";


export const EMPTY_SLATE_VALUE: Descendant[] = [
  {
    type: "paragraph",
    children: [{ text: "" }],
  },
];

export function buildInitialForm<T extends { slug: string; title: string }>(
  initial: T,
): T {
  if (!initial.slug && initial.title) {
    return { ...initial, slug: slugify(initial.title) };
  }
  return initial;
}

export function getEntityId(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;

  if (!("id" in value)) return undefined;

  const id = value.id;
  return typeof id === "string" && id.trim() ? id : undefined;
}

export type SlateLike = Descendant[] | string | null | undefined;

type SlateText = { text: string };
type SlateElementLike = { type?: string; children: unknown[]; [key: string]: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSlateText(value: unknown): value is SlateText {
  return isObject(value) && typeof value.text === "string";
}

function isSlateElementLike(value: unknown): value is SlateElementLike {
  return isObject(value) && Array.isArray(value.children);
}

function sanitizeDescendant(node: unknown): Descendant {
  if (isSlateText(node)) return node as Descendant;

  if (isSlateElementLike(node)) {
    const children = (node.children.length ? node.children : [{ text: "" }]).map(
      sanitizeDescendant,
    );
    return { ...node, children } as Descendant;
  }

  return { text: "" } as Descendant;
}

function sanitizeValue(value: unknown): Descendant[] {
  if (!Array.isArray(value) || value.length === 0) return EMPTY_SLATE_VALUE;

  return value.map(sanitizeDescendant).map((node) =>
    isSlateText(node)
      ? ({ type: "paragraph", children: [node] } as Descendant)
      : node,
  );
}

export function normalizeSlateValue(input: SlateLike): Descendant[] {
  if (Array.isArray(input)) return sanitizeValue(input);

  if (typeof input === "string") {
    const text = input.trim();
    if (!text) return EMPTY_SLATE_VALUE;
    return sanitizeValue([{ type: "paragraph", children: [{ text }] }]);
  }

  return EMPTY_SLATE_VALUE;
}

export function slateToString(value: SlateLike): string {
  return JSON.stringify(normalizeSlateValue(value));
}
