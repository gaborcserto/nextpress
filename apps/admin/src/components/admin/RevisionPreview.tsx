import { readRichContent, richContentText } from "@nextpress/shared/content";
import {
  readPageDocument,
  type PageBlock,
} from "@nextpress/shared/page-document";
import Image from "next/image";

function Block({ block }: { block: PageBlock }) {
  switch (block.type) {
    case "hero":
      return (
        <section>
          <h3>{block.props.title}</h3>
          <p>{block.props.description}</p>
          {block.props.mediaId && (
            <Image
              src={`/api/media/${block.props.mediaId}`}
              alt=""
              width={600}
              height={400}
              unoptimized
            />
          )}
        </section>
      );
    case "rich-text":
      return (
        <p style={{ whiteSpace: "pre-wrap" }}>
          {richContentText(block.props.document)}
        </p>
      );
    case "image":
      return (
        <Image
          src={`/api/media/${block.props.mediaId}`}
          alt={block.props.alt}
          width={600}
          height={400}
          unoptimized
        />
      );
    case "call-to-action":
      return <a href={block.props.href}>{block.props.label}</a>;
    case "columns":
      return (
        <div className="grid gap-4 md:grid-cols-2">
          {block.regions.map((region, index) => (
            <div key={index}>
              {region.map((child) => (
                <Block key={child.id} block={child} />
              ))}
            </div>
          ))}
        </div>
      );
    case "content-listing":
      return (
        <p>
          Content listing: up to {block.props.limit} published{" "}
          {block.props.kind.toLowerCase()} items
          {block.props.taxonomyId
            ? ` in taxonomy ${block.props.taxonomyId}`
            : ""}
          . Resolved by the public renderer.
        </p>
      );
  }
}

export default function RevisionPreview({
  title,
  content,
  pageDocument,
}: {
  title: string;
  content: string;
  pageDocument: string | null;
}) {
  const document = pageDocument ? readPageDocument(pageDocument) : null;

  return (
    <section aria-label="Authenticated revision preview">
      <h2>{title}</h2>
      <p style={{ whiteSpace: "pre-wrap" }}>
        {richContentText(readRichContent(content))}
      </p>
      {document?.supported &&
        document.document.blocks.map((block) => (
          <Block key={block.id} block={block} />
        ))}
    </section>
  );
}
