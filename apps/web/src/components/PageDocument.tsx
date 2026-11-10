import { PublicContentIndexSchema } from "@nextpress/shared/api-contracts";
import {
  PAGE_DOCUMENT_CAPABILITIES,
  type PageBlock,
  type PageDocument as Document,
} from "@nextpress/shared/page-document";
import Image from "next/image";
import Link from "next/link";

import { fetchPublic } from "@/lib/content/public-api.server";

import { RichContent } from "./RichContent";

export const PAGE_RENDERER_CAPABILITIES = PAGE_DOCUMENT_CAPABILITIES;

async function Block({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "rich-text":
      return <RichContent content={block.props.document} />;
    case "hero":
      return (
        <section>
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
      return <Link href={block.props.href}>{block.props.label}</Link>;
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
                <Block key={child.id} block={child} />
              ))}
            </section>
          ))}
        </div>
      );
    case "content-listing": {
      const params = new URLSearchParams({
        kind: block.props.kind,
        limit: String(block.props.limit),
      });

      if (block.props.taxonomyId)
        params.set("taxonomyId", block.props.taxonomyId);
      const listing = await fetchPublic(
        `content?${params}`,
        PublicContentIndexSchema,
      );

      return (
        <ul>
          {listing.items.map((item) => (
            <li key={item.slug}>
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
  }
}

export function PageDocument({ document }: { document: Document }) {
  return document.blocks.map((block) => <Block key={block.id} block={block} />);
}
