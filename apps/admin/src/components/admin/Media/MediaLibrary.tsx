"use client";

import {
  MediaBrowseSchema,
  MediaIdSchema,
  type MediaBrowse,
} from "@nextpress/shared/media";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useSWRConfig } from "swr";

import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import { initialMediaQuery, MediaBrowser } from "./MediaBrowser";
import { MediaDetails } from "./MediaDetails";
import { useMediaMessages } from "./messages";

export function MediaLibrary() {
  const params = useSearchParams();
  const { mutate } = useSWRConfig();
  const text = useMediaMessages();
  const [notice, setNotice] = useState("");
  const { view, asset, ...filters } = Object.fromEntries(params);
  const parsed = MediaBrowseSchema.safeParse(filters);
  const query = parsed.success ? parsed.data : initialMediaQuery;
  const assetId = MediaIdSchema.safeParse(asset);

  function setLocation(query: MediaBrowse, view?: string, asset?: string) {
    const next = new URLSearchParams({
      page: String(query.page),
      direction: query.direction,
      sort: query.sort,
    });

    if (query.q) {
      next.set("q", query.q);
    }

    if (query.mime) {
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
      (key) => typeof key === "string" && key.startsWith("/api/media/library?"),
    );
  }

  return (
    <AdminPageLayout title={text.library}>
      {notice && <p role="status">{notice}</p>}
      <MediaBrowser
        library
        query={query}
        onQuery={(next) => setLocation(next, view)}
        view={view === "list" ? "list" : "grid"}
        onView={(next) => setLocation(query, next)}
        onAsset={(asset) => setLocation(query, view, asset.id)}
      />
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
