import { readRichContent, RichDocumentSchema, textDocument, type RichDocument } from "@nextpress/shared/content";

/** Public presentation omits corrupt content without relaxing the canonical write contract. */
export function parsePublicRichContent(content: RichDocument | string | null): RichDocument {
  if (typeof content === "string" || content === null) {
    try {
      return readRichContent(content);
    } catch {
      return textDocument();
    }
  }
  const result = RichDocumentSchema.safeParse(content);
  return result.success ? result.data : textDocument();
}
