import { Fragment, type ReactNode } from "react";

import styles from "./RichContent.module.css";
import { parsePublicRichContent } from "@/lib/content/rich-content";
import type { RichBlock, RichDocument, RichText } from "@nextpress/shared/content";

const headings = { 2: "h2", 3: "h3", 4: "h4", 5: "h5", 6: "h6" } as const;

function renderText(leaf: RichText): ReactNode {
  let text: ReactNode = leaf.text;
  if (leaf.code) text = <code>{text}</code>;
  if (leaf.bold) text = <strong>{text}</strong>;
  if (leaf.italic) text = <em>{text}</em>;
  if (leaf.underline) text = <u>{text}</u>;
  if (leaf.strikethrough) text = <s>{text}</s>;
  return text;
}

function renderLeaves(leaves: RichText[]): ReactNode {
  return leaves.map((leaf, index) => <Fragment key={index}>{renderText(leaf)}</Fragment>);
}

function renderBlock(block: RichBlock): ReactNode {
  if (block.type === "bulleted-list" || block.type === "numbered-list") {
    const items = block.children.map((item, index) => (
      <li key={index} data-align={item.align}>{renderLeaves(item.children)}</li>
    ));
    return block.type === "bulleted-list"
      ? <ul data-align={block.align}>{items}</ul>
      : <ol data-align={block.align}>{items}</ol>;
  }

  const text = renderLeaves(block.children);
  switch (block.type) {
    case "paragraph":
      return <p data-align={block.align}>{text}</p>;
    case "heading": {
      // The canonical schema permits only h2 through h6; the page owns h1.
      const Heading = headings[block.level];
      return <Heading data-align={block.align}>{text}</Heading>;
    }
    case "blockquote":
      return <blockquote data-align={block.align}><p>{text}</p></blockquote>;
    case "code-block":
      return <pre tabIndex={0}><code>{block.children.map((leaf) => leaf.text).join("")}</code></pre>;
    case "list-item":
      // Legacy/editor documents can contain a top-level list item.
      return <ul><li data-align={block.align}>{text}</li></ul>;
  }
}

export function RichContent({ content }: { content: RichDocument | string | null }) {
  const document = parsePublicRichContent(content);
  return (
    <div className={styles.prose}>
      {document.blocks.map((block, index) => (
        <Fragment key={index}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}
