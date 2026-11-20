import { PAGE_DOCUMENT_CAPABILITIES } from "@nextpress/shared/page-document";

import { getDocumentListing } from "@/lib/content/document-listing.server";

import { DocumentListingItems, PageDocumentView } from "./PageDocumentView";

import type { PageDocument as Document } from "@nextpress/shared/page-document";

import type { DocumentListingProps } from "./PageDocumentView";

export const PAGE_RENDERER_CAPABILITIES = PAGE_DOCUMENT_CAPABILITIES;

async function DocumentListing(props: DocumentListingProps) {
  const listing = await getDocumentListing(props);

  return <DocumentListingItems items={listing.items} />;
}

export function PageDocument({ document }: { document: Document }) {
  return <PageDocumentView document={document} Listing={DocumentListing} />;
}
