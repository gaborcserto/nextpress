import {
  type PageBlock,
  type PageDocument as Document,
} from "@nextpress/shared/page-document";
import Image from "next/image";

import { LocaleLink as Link } from "@/lib/i18n/client";

import styles from "./PageDocument.module.css";
import { RichContent } from "./RichContent";

import type { ComponentType } from "react";

export type DocumentListingProps = Extract<
  PageBlock,
  { type: "content-listing" }
>["props"];
type ListingComponent = ComponentType<DocumentListingProps>;

export function DocumentListingItems({
  items,
}: {
  items: { type: "POST" | "PAGE"; slug: string; title: string }[];
}) {
  return (
    <ul>
      {items.map((item) => (
        <li key={`${item.type}:${item.slug}`}>
          <Link
            href={`/${item.type === "POST" ? "posts" : "pages"}/${item.slug}`}
          >
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Block({
  block,
  Listing,
}: {
  block: PageBlock;
  Listing: ListingComponent;
}) {
  switch (block.type) {
    case "rich-text":
      return <RichContent content={block.props.document} />;
    case "hero":
      return (
        <section className={styles.hero}>
          <h2>{block.props.title}</h2>
          <p>{block.props.description}</p>
          {block.props.mediaId && (
            <Image
              src={`/media/${block.props.mediaId}`}
              alt=""
              width={1200}
              height={800}
              unoptimized
              style={{ width: "100%", height: "auto" }}
            />
          )}
        </section>
      );
    case "image":
      return (
        <Image
          src={`/media/${block.props.mediaId}`}
          alt={block.props.alt}
          width={1200}
          height={800}
          unoptimized
          style={{ width: "100%", height: "auto" }}
        />
      );
    case "call-to-action":
      return (
        <Link className={styles.action} href={block.props.href}>
          {block.props.label}
        </Link>
      );
    case "columns":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(min(100%, 15rem), 1fr))",
            gap: "1rem",
          }}
        >
          {block.regions.map((region, index) => (
            <section key={index}>
              {region.map((child) => (
                <Block key={child.id} block={child} Listing={Listing} />
              ))}
            </section>
          ))}
        </div>
      );
    case "content-listing":
      return <Listing {...block.props} />;
  }
}

export function PageDocumentView({
  document,
  Listing,
}: {
  document: Document;
  Listing: ListingComponent;
}) {
  return (
    <div className={styles.document}>
      {document.blocks.map((block) => (
        <Block key={block.id} block={block} Listing={Listing} />
      ))}
    </div>
  );
}
