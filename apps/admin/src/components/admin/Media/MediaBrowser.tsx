"use client";

import {
  documentMime,
  MediaBrowseSchema,
  MediaInputMimeSchema,
  MediaCollectionSchema,
  type MediaAsset,
  type MediaBrowse,
} from "@nextpress/shared/media";
import Image from "next/image";
import {
  FaFilePdf,
  FaFolderOpen,
  FaList,
  FaSearch,
  FaSortAmountDownAlt,
  FaSortAmountUpAlt,
  FaThLarge,
} from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { safeImageUrl } from "@/lib/security/image-url";
import { AdminTimestamp } from "@/lib/settings/admin-date-time";
import { Button, Input, Select } from "@/ui/primitives";

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
  showUploads?: boolean;
  documents?: boolean;
  all?: boolean;
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
  showUploads = true,
  documents = false,
  all = false,
}: BrowserProps) {
  const text = useMediaMessages(documents);
  const params = new URLSearchParams({
    page: String(query.page),
    sort: query.sort,
    direction: query.direction,
  });

  if (all) {
    params.set("kind", "all");
  }

  if (query.q) {
    params.set("q", query.q);
  }

  if (query.mime) {
    params.set("mime", query.mime);
  }

  const { data, error, isLoading, mutate } = useSWR(
    `${documents ? "/api/documents" : "/api/media/library"}?${params}`,
    fetchCollection,
    { shouldRetryOnError: false },
  );

  const hasFilters = Boolean(query.q || query.mime || query.page > 1);

  function submitFilters(form: HTMLFormElement) {
    const values = new FormData(form);
    const next = MediaBrowseSchema.parse({
      q: values.get("q"),
      sort: values.get("sort"),
      direction: query.direction,
      mime: values.get("mime") || undefined,
    });

    onQuery(next);
  }

  return (
    <div className="grid min-w-0 gap-4">
      {showUploads && (
        <MediaUploads
          all={all}
          documents={documents}
          onUploaded={() => void mutate()}
        />
      )}
      <div className="min-w-0 overflow-hidden rounded-(--radius-surface) border border-(--surface-border) bg-base-100">
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-(--surface-border) bg-(--surface-rail) p-2 sm:p-3">
          <form
            key={params.toString()}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              submitFilters(event.currentTarget);
            }}
          >
            <div className="relative w-48 max-w-full">
              <Input
                id="media-search"
                name="q"
                aria-label={text.search}
                defaultValue={query.q}
                maxLength={100}
                placeholder={text.search}
                size="sm"
                rightIcon={<FaSearch size={14} />}
                className="w-full"
              />
              <button
                type="submit"
                aria-label={text.searchButton}
                title={text.searchButton}
                className="absolute end-1 top-1/2 z-10 grid size-8 -translate-y-1/2 place-items-center rounded-(--radius-control) text-(--control-icon) hover:text-(--control-icon-hover) focus-visible:outline-(length:--focus-width) focus-visible:outline-offset-(--focus-offset) focus-visible:outline-(--focus-color)"
              >
                <FaSearch size={14} aria-hidden="true" />
              </button>
            </div>
            {!documents && (
              <Select
                id="media-format"
                name="mime"
                aria-label={text.format}
                defaultValue={query.mime ?? ""}
                className="select-sm w-auto max-w-full"
                options={[
                  { value: "", label: all ? text.allFiles : text.any },
                  ...MediaInputMimeSchema.options.map((mime) => ({
                    value: mime,
                    label: mime.slice(6).toUpperCase(),
                  })),
                  ...(all ? [{ value: documentMime, label: "PDF" }] : []),
                ]}
                onChangeAction={() => {
                  const form =
                    document.querySelector<HTMLInputElement>(
                      "#media-search",
                    )?.form;

                  if (form) {
                    submitFilters(form);
                  }
                }}
              />
            )}
            <Select
              id="media-sort"
              name="sort"
              aria-label={text.sort}
              defaultValue={query.sort}
              className="select-sm w-auto max-w-full"
              options={[
                { value: "createdAt", label: text.createdAt },
                { value: "updatedAt", label: text.updatedAt },
                { value: "filename", label: text.filename },
                { value: "size", label: text.size },
              ]}
              onChangeAction={() => {
                const form =
                  document.querySelector<HTMLInputElement>(
                    "#media-search",
                  )?.form;

                if (form) {
                  submitFilters(form);
                }
              }}
            />
            <Button
              type="button"
              variant="ghost"
              className="size-10 min-h-10 min-w-10 border-0 bg-transparent p-0 text-(--control-icon) shadow-none hover:text-(--control-icon-hover) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-color)"
              aria-label={query.direction === "asc" ? text.newest : text.oldest}
              title={query.direction === "asc" ? text.newest : text.oldest}
              onClick={() =>
                onQuery({
                  ...query,
                  direction: query.direction === "asc" ? "desc" : "asc",
                  page: 1,
                })
              }
            >
              {query.direction === "asc" ? (
                <FaSortAmountUpAlt size={18} aria-hidden="true" />
              ) : (
                <FaSortAmountDownAlt size={18} aria-hidden="true" />
              )}
            </Button>
          </form>
          {onView && (
            <div
              className="ms-auto flex w-fit items-center gap-2 self-center"
              role="group"
              aria-label={text.view}
            >
              <Button
                type="button"
                variant="ghost"
                className={`size-10 min-h-10 min-w-10 border-0 bg-transparent p-0 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-color) ${view === "grid" ? "text-(--accent-solid)" : "text-(--control-icon)"}`}
                aria-pressed={view === "grid"}
                aria-label={text.grid}
                title={text.grid}
                onClick={() => onView("grid")}
              >
                <FaThLarge aria-hidden="true" size={18} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`size-10 min-h-10 min-w-10 border-0 bg-transparent p-0 shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-color) ${view === "list" ? "text-(--accent-solid)" : "text-(--control-icon)"}`}
                aria-pressed={view === "list"}
                aria-label={text.list}
                title={text.list}
                onClick={() => onView("list")}
              >
                <FaList aria-hidden="true" size={18} />
              </Button>
            </div>
          )}
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-3 sm:p-4">
          {error && (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert">{text.loadError}</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => void mutate()}
              >
                {text.retry}
              </Button>
            </div>
          )}
          {isLoading && <p role="status">{text.loading}</p>}
          {!isLoading && !error && data && data.items.length === 0 && (
            <div
              className="grid justify-items-center gap-2 py-10 text-center"
              role="status"
            >
              {hasFilters ? (
                <>
                  <h2 className="font-semibold">{text.noMatches}</h2>
                  <p className="max-w-prose text-sm text-(--text-muted)">
                    {text.noMatchesDescription}
                  </p>
                </>
              ) : (
                <>
                  <FaFolderOpen
                    aria-hidden
                    className="size-10 text-(--text-muted)"
                  />
                  <h2 className="font-semibold">{text.emptyHeading}</h2>
                  <p className="max-w-prose text-sm text-(--text-muted)">
                    {text.emptyDescription}
                  </p>
                </>
              )}
            </div>
          )}
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
                const isDocument = asset.mime === documentMime;

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
                        {isDocument ? (
                          <FaFilePdf aria-hidden="true" />
                        ) : (
                          <MediaThumbnail asset={{ ...asset, alt: "" }} />
                        )}
                        <span className="wrap-anywhere">
                          {isDocument ? asset.caption || name : name}
                          {isDocument && asset.caption && (
                            <small className="block">{name}</small>
                          )}
                          {view === "list" && (
                            <small className="block text-(--text-muted)">
                              {asset.originalMime ?? asset.mime} ·{" "}
                              {asset.size === null
                                ? text.unknown
                                : `${Math.ceil(asset.size / 1024)} KiB`}
                            </small>
                          )}
                          {isDocument && (
                            <small className="block text-(--text-muted)">
                              {text.createdAt}{" "}
                              <AdminTimestamp value={asset.createdAt} />
                              {asset.updatedAt && (
                                <>
                                  {" "}
                                  · {text.updatedAt}{" "}
                                  <AdminTimestamp value={asset.updatedAt} />
                                </>
                              )}
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
      </div>
    </div>
  );
}
