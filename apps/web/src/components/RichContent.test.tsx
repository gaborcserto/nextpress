import { serializeRichContent, textDocument, type RichDocument } from "@nextpress/shared/content";
import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichContent } from "./RichContent";

describe("RichContent", () => {
  it("renders canonical paragraphs and every supported heading below the page title", () => {
    const content: RichDocument = {
      version: 1,
      blocks: [
        { type: "paragraph", align: "center", children: [{ text: "Introduction" }] },
        ...([2, 3, 4, 5, 6] as const).map((level) => ({
          type: "heading" as const, level, children: [{ text: `Heading ${level}` }],
        })),
      ],
    };
    const { container } = render(<RichContent content={content} />);
    expect(screen.getByText("Introduction").tagName).toBe("P");
    expect(screen.getByText("Introduction")).toHaveAttribute("data-align", "center");
    for (const level of [2, 3, 4, 5, 6]) {
      expect(screen.getByRole("heading", { level, name: `Heading ${level}` })).toBeInTheDocument();
    }
    expect(container.querySelector("h1")).toBeNull();
  });

  it("renders all supported marks in deterministic nesting and keeps adjacent text intact", () => {
    const content = serializeRichContent([{ type: "paragraph", children: [
      { text: "Marked", bold: true, italic: true, underline: true, strikethrough: true, code: true },
      { text: " plain", bold: false },
    ] }]);
    const { container } = render(<RichContent content={content} />);
    expect(container.querySelector("p > s > u > em > strong > code")).toHaveTextContent("Marked");
    expect(container.querySelector("p")).toHaveTextContent("Marked plain");
    expect(container.querySelectorAll("strong")).toHaveLength(1);
  });

  it("renders ordered, unordered and standalone list items with native list semantics", () => {
    const content = serializeRichContent([
      { type: "bulleted-list", children: [{ type: "list-item", children: [{ text: "Bullet" }] }] },
      { type: "numbered-list", children: [{ type: "list-item", children: [{ text: "Number" }] }] },
      { type: "list-item", children: [{ text: "Standalone" }] },
    ]);
    render(<RichContent content={content} />);
    const lists = screen.getAllByRole("list");
    expect(lists.map((list) => list.tagName)).toEqual(["UL", "OL", "UL"]);
    for (const list of lists) expect(within(list).getAllByRole("listitem")).toHaveLength(1);
  });

  it("renders blockquotes and preserves preformatted code as text without inline mark nesting", () => {
    const source = 'const x = "<script>alert(1)</script>";\n  next();';
    const { container } = render(<RichContent content={serializeRichContent([
      { type: "blockquote", children: [{ text: "Quotation", italic: true }] },
      { type: "code-block", children: [{ text: source, code: true, bold: true }] },
    ])} />);
    expect(container.querySelector("blockquote > p > em")).toHaveTextContent("Quotation");
    expect(container.querySelector("pre > code")?.textContent).toBe(source);
    expect(container.querySelector("pre")).toHaveAttribute("tabindex", "0");
    expect(container.querySelector("pre code code, pre strong, script")).toBeNull();
  });

  it("uses the existing read compatibility for legacy Slate arrays", () => {
    render(<RichContent content={JSON.stringify([
      { type: "heading", level: 3, children: [{ text: "Legacy heading" }] },
      { type: "paragraph", children: [{ text: "Legacy bold", bold: true }] },
    ])} />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Legacy heading");
    expect(screen.getByText("Legacy bold").tagName).toBe("STRONG");
  });

  it.each([
    "Plain text\nSecond line", "https://example.test/long-path", "javascript:alert(1)",
    '<script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">click</a>',
  ])("keeps legacy text literal and never creates executable markup or links: %s", (content) => {
    const { container } = render(<RichContent content={content} />);
    expect(container.querySelector("p")?.textContent).toBe(content);
    expect(container.querySelector("script, img, a, iframe")).toBeNull();
  });

  it("escapes HTML-like text during server rendering as well as DOM rendering", () => {
    const source = '<script>alert(1)</script><img src="x" onerror="alert(2)">';
    const html = renderToStaticMarkup(<RichContent content={textDocument(source)} />);
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
  });

  it.each([
    "[", "[]", '{"version":2,"blocks":[]}', "x".repeat(1_000_001),
    JSON.stringify({ version: 1, blocks: [{ type: "heading", level: 1, children: [{ text: "Invalid h1" }] }] }),
    JSON.stringify({ version: 1, blocks: [{ type: "html", children: [{ text: "Unsupported" }] }] }),
    JSON.stringify({ version: 1, blocks: [{ type: "paragraph", children: [{ type: "link", url: "javascript:alert(1)", children: [{ text: "Unsafe" }] }] }] }),
    JSON.stringify({ version: 1, blocks: [{ type: "paragraph", style: "color:red", className: "arbitrary", children: [{ text: "Injected" }] }] }),
  ])("omits malformed and unsupported serialized content safely (case %#)", (content) => {
    const { container } = render(<RichContent content={content} />);
    expect(container.textContent).toBe("");
    expect(container.querySelector("h1, a, script, [style], .arbitrary")).toBeNull();
  });

  it("revalidates document objects at the rendering boundary", () => {
    const document = textDocument("Original");
    Object.assign(document.blocks[0], { type: "script" });
    expect(renderToStaticMarkup(<RichContent content={document} />)).not.toContain("Original");
  });

  it("accepts missing content without requiring client rendering", () => {
    expect(renderToStaticMarkup(<RichContent content={null} />)).toContain("<p></p>");
    const source = readFileSync(resolve("src/components/RichContent.tsx"), "utf8");
    expect(source).not.toMatch(/^[\s]*["']use client["']/);
  });

  it("uses semantic variables for prose presentation without a separate palette", () => {
    const css = readFileSync(resolve("src/components/RichContent.module.css"), "utf8");
    expect(css).toContain("var(--prose-width)");
    const colorDeclarations = css.match(/(?:^|[;{])\s*(?:color|background|border(?:-inline-start)?)\s*:[^;]+/gm) ?? [];
    expect(colorDeclarations.length).toBeGreaterThan(0);
    for (const declaration of colorDeclarations) expect(declaration).toContain("var(--color-");
    expect(css).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
