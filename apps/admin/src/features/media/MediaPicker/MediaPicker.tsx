"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";

import tabStyles from "@/ui/components/TabStrip.module.css";
import { AdminButton } from "@/ui/primitives";

import { isMediaBrowseKey } from "../media-browse-key";
import { initialMediaQuery, MediaBrowser } from "../MediaBrowser/MediaBrowser";
import { MediaDialog } from "../MediaDialog";
import { MediaUploads } from "../MediaUploads/MediaUploads";
import { useMediaMessages } from "../messages";

import type { MediaAsset } from "@nextpress/shared/media";

export function DocumentPicker(
  props: Omit<Parameters<typeof MediaPicker>[0], "documents">,
) {
  return <MediaPicker {...props} documents />;
}

export function MediaPicker({
  onCancel,
  onConfirm,
  limit = 1,
  documents = false,
  mode,
  title,
  uploadLabel,
}: {
  limit?: number;
  documents?: boolean;
  mode?: "images" | "documents" | "mixed";
  title?: string;
  uploadLabel?: string;
  onCancel: () => void;
  onConfirm: (assets: MediaAsset[]) => void;
}) {
  const mixed = mode === "mixed";
  documents = mode === "documents" || documents;
  const text = useMediaMessages(documents);
  const { mutate } = useSWRConfig();
  const [query, setQuery] = useState(initialMediaQuery);
  const [selected, setSelected] = useState<MediaAsset[]>([]);
  const [view, setView] = useState<"library" | "upload">("library");

  function toggle(asset: MediaAsset) {
    setSelected((current) => {
      if (current.some(({ id }) => id === asset.id)) {
        return current.filter(({ id }) => id !== asset.id);
      }

      if (limit === 1) {
        return [asset];
      }

      return current.length < limit ? [...current, asset] : current;
    });
  }

  function handleUpload(assets: MediaAsset[], complete: boolean) {
    void mutate(isMediaBrowseKey);

    const latestAsset = assets.at(-1);

    if (!complete || !latestAsset) {
      return;
    }

    setSelected((current) =>
      limit === 1 ? [latestAsset] : [...current, ...assets].slice(0, limit),
    );
    setQuery(initialMediaQuery);
    setView("library");
  }

  return (
    <MediaDialog
      title={title ?? (limit === 1 ? text.choose : text.chooseMany)}
      onClose={onCancel}
    >
      <div className="admin-tab-stack">
        <div
          aria-label={text.library}
          className={tabStyles.tabs}
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "library"}
            tabIndex={view === "library" ? 0 : -1}
            onClick={() => setView("library")}
          >
            {text.library}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "upload"}
            tabIndex={view === "upload" ? 0 : -1}
            onClick={() => setView("upload")}
          >
            {uploadLabel ?? text.upload}
          </button>
        </div>
        <div className="admin-media-dialog-content min-h-64">
          {view === "library" ? (
            <MediaBrowser
              query={query}
              documents={documents}
              all={mixed}
              view={documents ? "list" : "grid"}
              onQuery={setQuery}
              onAsset={toggle}
              selected={selected.map(({ id }) => id)}
              showUploads={false}
            />
          ) : (
            <MediaUploads
              documents={documents}
              all={mixed}
              multiple={limit !== 1}
              onUploaded={handleUpload}
            />
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        {view === "library" && (
          <span role="status">
            {text.selected} {selected.length} / {limit}
          </span>
        )}
        <div className="ms-auto flex items-center gap-2">
          <AdminButton type="button" variant="ghost" onClick={onCancel}>
            {text.cancel}
          </AdminButton>
          {view === "library" && (
            <AdminButton
              type="button"
              disabled={!selected.length || selected.length > limit}
              onClick={() => onConfirm(selected)}
            >
              {text.confirm}
            </AdminButton>
          )}
        </div>
      </div>
    </MediaDialog>
  );
}
