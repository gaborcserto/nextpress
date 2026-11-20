"use client";

import { resolvePageType } from "@nextpress/shared/content";
import { readPageDocument } from "@nextpress/shared/page-document";
import { useEffect, useMemo, useState } from "react";

import {
  DocumentListingItems,
  PageDocumentView,
} from "@/components/PageDocumentView";
import { GalleryEmpty } from "@/components/public-content/GalleryEmpty";
import { RichContent } from "@/components/RichContent";
import { UiText } from "@/lib/i18n/client";
import { BlogArchive } from "@/templates/blog/BlogArchive";
import { BlogPage } from "@/templates/blog/BlogPage";

import { getPreviewDocumentListing, getPreviewPosts } from "./actions";

import type { LivePreviewSnapshot } from "@nextpress/shared/revisions";
import type { ReactNode } from "react";

import type { DocumentListingProps } from "@/components/PageDocumentView";
import type { ArchiveProps } from "@/templates/types";

export type PreviewAppearance = Pick<
  ArchiveProps,
  "postsPerPage" | "listingMode" | "listVariant"
>;

function PreviewDocumentListing({
  kind,
  limit,
  taxonomyId,
}: DocumentListingProps) {
  const [items, setItems] = useState<Awaited<
    ReturnType<typeof getPreviewDocumentListing>
  > | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    void getPreviewDocumentListing({ kind, limit, taxonomyId })
      .then((result) => {
        if (active) {
          setItems(result);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, [kind, limit, taxonomyId]);

  if (failed) {
    return (
      <p role="alert">
        <UiText id="posts.loadError" />
      </p>
    );
  }

  return items ? (
    <DocumentListingItems items={items} />
  ) : (
    <p role="status">
      <UiText id="posts.loading" />
    </p>
  );
}

function PreviewPostsPage({
  snapshot,
  appearance,
  children,
}: {
  snapshot: LivePreviewSnapshot;
  appearance: PreviewAppearance;
  children: ReactNode;
}) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    page: number;
    batch: Awaited<ReturnType<typeof getPreviewPosts>>;
    failed?: boolean;
  } | null>(null);
  const tag = snapshot.listingTagSlug ?? null;

  useEffect(() => {
    let active = true;

    void getPreviewPosts(page, tag)
      .then((batch) => {
        if (active) {
          setResult({ page, batch });
        }
      })
      .catch(() => {
        if (active) {
          setResult({ page, batch: null, failed: true });
        }
      });

    return () => {
      active = false;
    };
  }, [page, tag]);

  const navigation = useMemo(
    () => ({
      changePage: setPage,
      loadPage: (nextPage: number) => getPreviewPosts(nextPage, tag),
    }),
    [tag],
  );
  const batch = result?.batch;

  return (
    <BlogArchive
      {...appearance}
      title={snapshot.title}
      basePath={`/pages/${encodeURIComponent(snapshot.slug)}`}
      page={result?.page ?? 1}
      posts={batch?.posts ?? []}
      hasMore={batch?.hasMore ?? false}
      previewNavigation={navigation}
    >
      <RichContent content={snapshot.content} />
      {children}
      {result?.page !== page && (
        <p role="status">
          <UiText id="posts.loading" />
        </p>
      )}
      {result?.failed && (
        <p role="alert">
          <UiText id="posts.loadError" />
        </p>
      )}
    </BlogArchive>
  );
}

export function PreviewPageContent({
  snapshot,
  appearance,
}: {
  snapshot: LivePreviewSnapshot;
  appearance: PreviewAppearance;
}) {
  const type = resolvePageType(snapshot.layout);
  const raw = snapshot.pageDocument;
  const document = useMemo(() => (raw ? readPageDocument(raw) : null), [raw]);
  const blocks = document?.supported && (
    <PageDocumentView
      key={raw}
      document={document.document}
      Listing={PreviewDocumentListing}
    />
  );

  if (type === "posts") {
    return (
      <PreviewPostsPage
        key={JSON.stringify([snapshot.slug, snapshot.listingTagSlug])}
        snapshot={snapshot}
        appearance={appearance}
      >
        {blocks}
      </PreviewPostsPage>
    );
  }

  return (
    <BlogPage content={snapshot}>
      {blocks}
      {type === "gallery" && <GalleryEmpty />}
    </BlogPage>
  );
}
