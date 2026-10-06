import { serializeRichContent, textDocument, type RichBlock } from "@nextpress/shared/content";

type DevelopmentPage = {
  id: string;
  type: "POST" | "PAGE";
  slug: string;
  title: string;
  excerpt: string | null;
  blocks: RichBlock[];
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
  inHeaderMenu?: boolean;
  inFooterMenu?: boolean;
  taxonomies: string[];
};

const paragraph = (text: string): RichBlock => ({ type: "paragraph", children: [{ text }] });
const heading = (level: 2 | 3 | 4, text: string): RichBlock => ({ type: "heading", level, children: [{ text }] });

export const developmentTaxonomies = [
  { id: "dev-seed-tag-nextjs", type: "TAG" as const, slug: "nextjs", name: "Next.js" },
  { id: "dev-seed-tag-typescript", type: "TAG" as const, slug: "typescript", name: "TypeScript" },
  { id: "dev-seed-tag-accessibility", type: "TAG" as const, slug: "accessibility", name: "Accessibility" },
  { id: "dev-seed-tag-architecture", type: "TAG" as const, slug: "architecture", name: "Architecture" },
];

const typographyBlocks: RichBlock[] = [
  paragraph("This style guide is an editable page for checking the public renderer against the same structured content used by the admin editor."),
  heading(2, "Text and emphasis"),
  { type: "paragraph", children: [
    { text: "Strong text", bold: true }, { text: " and " }, { text: "emphasized text", italic: true },
    { text: "; " }, { text: "underlined text", underline: true }, { text: "; and " },
    { text: "struck-through text", strikethrough: true }, { text: ". Inline " }, { text: "code", code: true }, { text: " stays readable in a sentence." },
  ] },
  heading(3, "Lists and quotations"),
  { type: "bulleted-list", children: [
    { type: "list-item", children: [{ text: "A short item" }] },
    { type: "list-item", children: [{ text: "An item with " }, { text: "emphasis", italic: true }] },
  ] },
  { type: "numbered-list", children: [
    { type: "list-item", children: [{ text: "First, preserve the content contract." }] },
    { type: "list-item", children: [{ text: "Then check the rendered spacing." }] },
  ] },
  { type: "blockquote", children: [{ text: "Good typography makes the structure of an article easier to follow." }] },
  heading(4, "A smaller section"),
  { type: "code-block", children: [{ text: "const content = await loadPublishedArticle({ slug: 'typography-and-structured-content' });\nconsole.log(content.title); // long code lines should wrap or scroll safely" }] },
];

const longArticleBlocks: RichBlock[] = [
  paragraph("A maintainable content system starts with a small number of clear boundaries. The editor owns authoring, the database stores a versioned document, and public reads select only fields that a visitor can use."),
  heading(2, "Keep the document predictable"),
  paragraph("Structured blocks make headings, paragraphs, lists, quotations, and code visible to both the editor and renderer. A document stays useful when each side agrees on the same schema and unknown shapes fail safely."),
  heading(3, "Let the server enforce publication"),
  paragraph("The public query checks the content type, publication status, and publication date in one place. A hidden button in the admin can improve the editing experience, but it cannot replace that server boundary."),
  { type: "blockquote", children: [{ text: "A public projection is a deliberate contract: select what the page needs, then leave account and operational data behind." }] },
  heading(3, "Make change easy to review"),
  paragraph("Stable slugs help developers navigate fixture records. Stable seed identifiers make repeat runs update the records that belong to the seed while allowing unrelated local work to remain in place."),
  { type: "bulleted-list", children: [
    { type: "list-item", children: [{ text: "Validate structured content before persistence." }] },
    { type: "list-item", children: [{ text: "Use explicit public database projections." }] },
    { type: "list-item", children: [{ text: "Keep local fixtures out of production." }] },
  ] },
  heading(2, "Check the reading experience"),
  paragraph("Long form content gives future article layouts enough material to show a table of contents, generous prose width, section spacing, and responsive behavior without relying on placeholder copy."),
  { type: "paragraph", children: [{ text: "A deliberately long unbroken token helps reveal overflow problems: " }, { text: "nextpressdevelopmentcontentboundarytypographyresponsivelayoutaccessibilitycanonicalrichdocument", code: true }, { text: ". A URL-like string can reveal the same issue: https://example.test/a/very/long/path/used/only/as/readable/development/copy/for/wrapping-checks." }] },
  { type: "numbered-list", children: [
    { type: "list-item", children: [{ text: "Read the article in the admin editor." }] },
    { type: "list-item", children: [{ text: "Save a harmless edit and reopen it." }] },
    { type: "list-item", children: [{ text: "Render only through the public content boundary." }] },
  ] },
];

export const developmentPages: DevelopmentPage[] = [
  {
    id: "dev-seed-post-structured-content", type: "POST", slug: "structured-content-for-real-pages",
    title: "Structured content for real pages", excerpt: "A practical look at the boundary between an editor, stored documents, and public rendering.",
    blocks: [paragraph("A content editor is most useful when the document it saves has a stable shape. This article introduces the structured blocks used by NextPress and shows how a small contract can support both editing and server rendering."), heading(2, "One representation across the stack"), { type: "paragraph", children: [{ text: "The document uses " }, { text: "versioned blocks", bold: true }, { text: " so the admin can reopen content and the public renderer can make semantic HTML from validated data." }] }, { type: "blockquote", children: [{ text: "Content should be data that the application understands, not a string that bypasses its rules." }] }],
    status: "PUBLISHED", publishedAt: new Date("2025-03-10T09:00:00.000Z"), taxonomies: ["nextjs", "architecture"],
  },
  {
    id: "dev-seed-post-interface-details", type: "POST", slug: "small-interface-details-that-matter",
    title: "Small interface details that make a content site feel considered",
    excerpt: "Spacing, readable line lengths, and accessible controls shape the reading experience as much as color does.",
    blocks: [paragraph("A design system earns trust through repeated small decisions. Consistent spacing helps people scan a page, while clear focus styles make controls easier to use with a keyboard."), heading(2, "Start with readable defaults"), { type: "paragraph", children: [{ text: "Use " }, { text: "comfortable line length", italic: true }, { text: " for long reading, and keep labels close to the controls they describe." }] }, heading(3, "Keep the details consistent"), paragraph("A button, menu item, and form field should share understandable interaction states. The same is true for article headings and captions: repeated patterns help visitors predict what comes next.")],
    status: "PUBLISHED", publishedAt: new Date("2025-03-12T11:30:00.000Z"), taxonomies: ["accessibility"],
  },
  {
    id: "dev-seed-post-long-form", type: "POST", slug: "building-content-that-stays-maintainable",
    title: "Building content that stays maintainable as an application grows",
    excerpt: "A longer article fixture for testing section rhythm, lists, quotations, code, and text wrapping across screen sizes.",
    blocks: longArticleBlocks, status: "PUBLISHED", publishedAt: new Date("2025-03-14T08:15:00.000Z"), taxonomies: ["typescript", "architecture"],
  },
  {
    id: "dev-seed-post-quick-note", type: "POST", slug: "a-quick-note-on-clear-content",
    title: "Quick note", excerpt: null,
    blocks: [paragraph("A short post with an empty optional excerpt and no media. It helps check compact cards and the fallback summary behavior.")],
    status: "PUBLISHED", publishedAt: new Date("2025-03-16T15:00:00.000Z"), taxonomies: [],
  },
  {
    id: "dev-seed-post-draft", type: "POST", slug: "draft-reviewing-an-article",
    title: "DRAFT — Reviewing an article before publication", excerpt: "This draft should appear in admin and stay out of public reads.",
    blocks: [paragraph("A draft fixture for checking status labels, edit forms, and the published-only public boundary.")],
    status: "DRAFT", publishedAt: null, taxonomies: [],
  },
  {
    id: "dev-seed-post-scheduled", type: "POST", slug: "scheduled-content-boundary-check",
    title: "SCHEDULED — A future publication boundary check", excerpt: "This published-status record has a date in the future and should remain unavailable publicly until then.",
    blocks: [paragraph("The publication date is set to 2999 so this fixture remains scheduled during ordinary local development.")],
    status: "PUBLISHED", publishedAt: new Date("2999-01-01T09:00:00.000Z"), taxonomies: [],
  },
  {
    id: "dev-seed-page-about", type: "PAGE", slug: "about-nextpress",
    title: "About NextPress", excerpt: "A simple about page for future public page layouts.",
    blocks: [paragraph("NextPress is a content management project built around an editable admin and a clear boundary for public content."), heading(2, "A practical foundation"), paragraph("Pages use the same structured rich-content document as posts, so editors can work with a familiar set of blocks.")],
    status: "PUBLISHED", publishedAt: new Date("2025-03-01T10:00:00.000Z"), inHeaderMenu: true, taxonomies: [],
  },
  {
    id: "dev-seed-page-contact", type: "PAGE", slug: "contact",
    title: "Contact", excerpt: "A compact page fixture with a concise heading and body.",
    blocks: [paragraph("This local example gives a future contact page a starting point. Add a real contact workflow only when the application supports one.")],
    status: "PUBLISHED", publishedAt: new Date("2025-03-02T10:00:00.000Z"), inFooterMenu: true, taxonomies: [],
  },
  {
    id: "dev-seed-page-style-guide", type: "PAGE", slug: "typography-and-structured-content",
    title: "Typography and structured content: a public style guide for layout testing",
    excerpt: "A development page with supported headings, text marks, lists, a quotation, and a code sample.",
    blocks: typographyBlocks, status: "PUBLISHED", publishedAt: new Date("2025-03-03T10:00:00.000Z"), taxonomies: ["accessibility"],
  },
];

export function serializeDevelopmentContent(page: DevelopmentPage): { content: string; excerpt: string | null } {
  return {
    content: serializeRichContent(page.blocks),
    excerpt: page.excerpt === null ? null : serializeRichContent(textDocument(page.excerpt).blocks),
  };
}
