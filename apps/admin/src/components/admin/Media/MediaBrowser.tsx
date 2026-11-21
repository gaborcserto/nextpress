"use client";

import {
  MediaBrowseSchema,
  MediaInputMimeSchema,
  MediaCollectionSchema,
  type MediaAsset,
  type MediaBrowse,
} from "@nextpress/shared/media";
import Image from "next/image";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { safeImageUrl } from "@/lib/security/image-url";
import { Button } from "@/ui/primitives";

import { MediaUploads } from "./MediaUploads";
import { useMediaMessages } from "./messages";

export const initialMediaQuery = MediaBrowseSchema.parse({});

export function MediaThumbnail({
  asset,
  showGif = false,
}: {
  showGif?: boolean;
  asset: {
    id: string;
    url: string;
    mime?: string | null;
    alt?: string | null;
    width?: number | null;
    height?: number | null;
  };
}) {
  const url =
    asset.url === `/media/${asset.id}`
      ? `/api/media/${asset.id}`
      : safeImageUrl(asset.url);

  if (!url) {
    return null;
  }

  if (asset.mime === "image/gif" && !showGif) {
    return (
      <span className="grid aspect-[4/3] place-items-center rounded-md bg-base-200">
        GIF
      </span>
    );
  }

  return (
    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-base-200">
      <Image
        src={url}
        alt={asset.alt ?? ""}
        fill
        sizes="(max-width: 640px) 50vw, 240px"
        loading="lazy"
        unoptimized
        className="object-contain"
      />
    </span>
  );
}

type BrowserProps = {
  query: MediaBrowse;
  onQuery: (query: MediaBrowse) => void;
  view?: "grid" | "list";
  onView?: (view: "grid" | "list") => void;
  onAsset: (asset: MediaAsset) => void;
  selected?: readonly string[];
  library?: boolean;
};

async function fetchCollection(url: string) {
  return MediaCollectionSchema.parse(
    await jsonFetcher<unknown>(url, { cache: "no-store" }),
  );
}

export function MediaBrowser({
  query,
  onQuery,
  view = "grid",
  onView,
  onAsset,
  selected,
  library,
}: BrowserProps) {
  const text = useMediaMessages();
  const params = new URLSearchParams({
    page: String(query.page),
    sort: query.sort,
    direction: query.direction,
  });

  if (query.q) {
    params.set("q", query.q);
  }

  if (query.mime) {
    params.set("mime", query.mime);
  }

  const { data, error, mutate } = useSWR(
    `/api/media/library?${params}`,
    fetchCollection,
    { shouldRetryOnError: false },
  );

  return (
    <div className="grid gap-4">
      <MediaUploads onUploaded={() => void mutate()} />
      <form
        key={params.toString()}
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          const form = new FormData(event.currentTarget);
          const next = MediaBrowseSchema.parse({
            q: form.get("q"),
            sort: form.get("sort"),
            direction: form.get("direction"),
            mime: form.get("mime") || undefined,
          });
          onQuery(next);
        }}
      >
        <label className="grid min-w-0 grow gap-1 text-sm">
          {text.search}
          <input
            name="q"
            defaultValue={query.q}
            maxLength={100}
            className="input w-full"
          />
        </label>
        <label className="grid gap-1 text-sm">
          {text.format}
          <select
            name="mime"
            defaultValue={query.mime ?? ""}
            className="select"
          >
            <option value="">{text.any}</option>
            {MediaInputMimeSchema.options.map((mime) => (
              <option key={mime} value={mime}>
                {mime.slice(6).toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {text.sort}
          <select name="sort" defaultValue={query.sort} className="select">
            <option value="createdAt">{text.createdAt}</option>
            <option value="updatedAt">{text.updatedAt}</option>
            <option value="filename">{text.filename}</option>
            <option value="size">{text.size}</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {text.direction}
          <select
            name="direction"
            defaultValue={query.direction}
            className="select"
          >
            <option value="desc">{text.newest}</option>
            <option value="asc">{text.oldest}</option>
          </select>
        </label>
        <Button type="submit">{text.searchButton}</Button>
      </form>
      {onView && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            aria-pressed={view === "grid"}
            onClick={() => onView("grid")}
          >
            {text.grid}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={view === "list"}
            onClick={() => onView("list")}
          >
            {text.list}
          </Button>
        </div>
      )}
      {error && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert">{text.loadError}</p>
          <Button type="button" variant="outline" onClick={() => void mutate()}>
            {text.retry}
          </Button>
        </div>
      )}
      {!data && !error && <p role="status">{text.loading}</p>}
      {data && data.items.length === 0 && <p role="status">{text.empty}</p>}
      {data && data.items.length > 0 && (
        <ul
          className={
            view === "grid"
              ? "grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4"
              : "grid gap-1"
          }
        >
          {data.items.map((asset) => {
            const active = selected?.includes(asset.id);
            const name = asset.filename ?? asset.id;

            return (
              <li key={asset.id} className="min-w-0">
                <button
                  type="button"
                  aria-pressed={library ? undefined : active}
                  onClick={() => onAsset(asset)}
                  className={`w-full rounded-lg border p-2 text-start hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary ${active ? "border-primary bg-base-200" : "border-base-300"}`}
                >
                  <span
                    className={
                      view === "list"
                        ? "grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3"
                        : "grid gap-2"
                    }
                  >
                    <MediaThumbnail asset={{ ...asset, alt: "" }} />
                    <span className="wrap-anywhere">
                      {name}
                      {view === "list" && (
                        <small className="block text-(--text-muted)">
                          {asset.originalMime ?? asset.mime} ·{" "}
                          {asset.size === null
                            ? text.unknown
                            : `${Math.ceil(asset.size / 1024)} KiB`}
                        </small>
                      )}
                      {active && (
                        <small className="block font-semibold">
                          {text.selected}
                        </small>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {(query.page > 1 || data?.hasMore) && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={query.page <= 1}
            onClick={() => onQuery({ ...query, page: query.page - 1 })}
          >
            {text.previous}
          </Button>
          <span>
            {text.page} {query.page}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={!data?.hasMore}
            onClick={() => onQuery({ ...query, page: query.page + 1 })}
          >
            {text.next}
          </Button>
        </div>
      )}
    </div>
  );
}
