import {
  readRichContent,
  RichBlocksSchema,
  serializeRichContent,
} from "@nextpress/shared/content";
import { slugify } from "@nextpress/shared/slugify";

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
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!("id" in value)) {
    return undefined;
  }

  const id = value.id;

  return typeof id === "string" && id.trim() ? id : undefined;
}

export type SlateLike = Descendant[] | string | null | undefined;

export function normalizeSlateValue(input: SlateLike): Descendant[] {
  if (Array.isArray(input)) {
    return input.length
      ? RichBlocksSchema.parse(input)
      : readRichContent(null).blocks;
  }

  return readRichContent(input ?? null).blocks;
}

export function slateToString(value: SlateLike): string {
  return serializeRichContent(normalizeSlateValue(value));
}
