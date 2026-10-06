import { RichDocumentSchema } from "@nextpress/shared/content";
import { describe, expect, it } from "vitest";

import { developmentPages, developmentTaxonomies, serializeDevelopmentContent } from "../prisma/development-content";

describe("development content fixtures", () => {
  it("uses stable unique IDs and slugs for every seed-owned record", () => {
    for (const records of [developmentPages, developmentTaxonomies]) {
      expect(new Set(records.map(({ id }) => id)).size).toBe(records.length);
      expect(new Set(records.map(({ slug }) => slug)).size).toBe(records.length);
    }
  });

  it("serializes every body and non-empty excerpt through the canonical rich-content schema", () => {
    for (const page of developmentPages) {
      const serialized = serializeDevelopmentContent(page);
      expect(RichDocumentSchema.parse(JSON.parse(serialized.content)).version).toBe(1);
      if (serialized.excerpt) expect(RichDocumentSchema.parse(JSON.parse(serialized.excerpt)).version).toBe(1);
    }
  });

  it("covers public, draft, future, page, and supported rich-content states", () => {
    expect(developmentPages.filter(({ type, status, publishedAt }) => type === "POST" && status === "PUBLISHED" && publishedAt && publishedAt.getTime() < Date.now())).toHaveLength(4);
    expect(developmentPages.some(({ status }) => status === "DRAFT")).toBe(true);
    expect(developmentPages.some(({ status, publishedAt }) => status === "PUBLISHED" && publishedAt && publishedAt.getTime() > Date.now())).toBe(true);
    expect(developmentPages.some(({ type }) => type === "PAGE")).toBe(true);
    const blocks = developmentPages.flatMap(({ blocks }) => blocks);
    expect(blocks.some(({ type }) => type === "heading")).toBe(true);
    expect(blocks.some(({ type }) => type === "blockquote")).toBe(true);
    expect(blocks.some(({ type }) => type === "bulleted-list")).toBe(true);
    expect(blocks.some(({ type }) => type === "numbered-list")).toBe(true);
    expect(blocks.some(({ type }) => type === "code-block")).toBe(true);
    expect(blocks.some(({ type, children }) => type === "paragraph" && children.some((child) => child.bold || child.italic || child.underline || child.strikethrough || child.code))).toBe(true);
  });
});
