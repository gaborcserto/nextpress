"use client";

import { useState } from "react";

import { Button } from "@/ui/primitives";

import { initialMediaQuery, MediaBrowser } from "./MediaBrowser";
import { MediaDialog } from "./MediaDialog";
import { useMediaMessages } from "./messages";

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
}: {
  limit?: number;
  documents?: boolean;
  onCancel: () => void;
  onConfirm: (assets: MediaAsset[]) => void;
}) {
  const text = useMediaMessages(documents);
  const [query, setQuery] = useState(initialMediaQuery);
  const [selected, setSelected] = useState<MediaAsset[]>([]);

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

  return (
    <MediaDialog
      title={limit === 1 ? text.choose : text.chooseMany}
      onClose={onCancel}
    >
      <MediaBrowser
        query={query}
        documents={documents}
        view={documents ? "list" : "grid"}
        onQuery={setQuery}
        onAsset={toggle}
        selected={selected.map(({ id }) => id)}
      />
      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <span role="status">
          {text.selected} {selected.length} / {limit}
        </span>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {text.cancel}
        </Button>
        <Button
          type="button"
          disabled={!selected.length}
          onClick={() => onConfirm(selected)}
        >
          {text.confirm}
        </Button>
      </div>
    </MediaDialog>
  );
}
