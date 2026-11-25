"use client";

import {
  AssetKindSchema,
  MediaBrowseSchema,
  type AssetKind,
  MediaIdSchema,
  type MediaBrowse,
} from "@nextpress/shared/media";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

import { Section } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { initialMediaQuery, MediaBrowser } from "./MediaBrowser";
import { MediaDetails } from "./MediaDetails";
import { MediaUploads } from "./MediaUploads";
import { useMediaMessages } from "./messages";
import styles from "../SettingsScreen/SettingsTabs.module.css";

export function MediaLibrary() {
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const text = useMediaMessages();
  const [notice, setNotice] = useState("");
  const {
    view,
    asset,
    kind: requestedKind,
    ...filters
  } = Object.fromEntries(params);
  const kind = AssetKindSchema.catch("all").parse(requestedKind);
  const documents = kind === "document";
  const parsed = MediaBrowseSchema.safeParse(
    documents ? { ...filters, mime: undefined } : filters,
  );
  const query = parsed.success ? parsed.data : initialMediaQuery;
  const assetId = MediaIdSchema.safeParse(asset);

  function setLocation(
    query: MediaBrowse,
    view?: string,
    asset?: string,
    nextKind: AssetKind = kind,
  ) {
    const next = new URLSearchParams({
      kind: nextKind,
      page: String(query.page),
      direction: query.direction,
      sort: query.sort,
    });

    if (query.q) {
      next.set("q", query.q);
    }

    if (query.mime && nextKind !== "document") {
      next.set("mime", query.mime);
    }

    if (view === "list") {
      next.set("view", view);
    }

    if (asset) {
      next.set("asset", asset);
    }

    window.history.pushState(null, "", `?${next}`);
  }

  function refresh() {
    void mutate(
      (key) =>
        typeof key === "string" &&
        (key.startsWith("/api/documents?") ||
          key.startsWith("/api/media/library?")),
    );
  }

  return (
    <AdminPageLayout title={text.library} description={text.libraryDescription}>
      <Section title={text.uploadFiles}>
        <MediaUploads
          all={kind === "all"}
          documents={documents}
          onUploaded={refresh}
        />
      </Section>
      <nav aria-label={text.library} role="tablist" className={styles.tabs}>
        {AssetKindSchema.options.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={kind === tab}
            tabIndex={kind === tab ? 0 : -1}
            onClick={() =>
              setLocation(
                { ...query, page: 1, mime: undefined },
                view,
                undefined,
                tab,
              )
            }
          >
            {text.assetKinds[tab]}
          </button>
        ))}
      </nav>
      {notice && <p role="status">{notice}</p>}
      <Section title={text.mediaFiles}>
        <MediaBrowser
          library
          showUploads={false}
          all={kind === "all"}
          documents={documents}
          query={query}
          onQuery={(next) => setLocation(next, view)}
          view={view === "list" ? "list" : "grid"}
          onView={(next) => setLocation(query, next)}
          onAsset={(asset) => setLocation(query, view, asset.id)}
        />
      </Section>
      {assetId.success && (
        <MediaDetails
          id={assetId.data}
          onClose={() => setLocation(query, view)}
          onChange={refresh}
          onDelete={() => {
            refresh();
            setLocation(query, view);
            setNotice(text.deleted);
          }}
        />
      )}
    </AdminPageLayout>
  );
}

export function MediaAccessDenied() {
  const text = useMediaMessages();

  return <p role="alert">{text.forbidden}</p>;
}
