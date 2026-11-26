"use client";

import {
  documentMime,
  MediaBrowseSchema,
  MediaInputMimeSchema,
  MediaCollectionSchema,
  type MediaAsset,
  type MediaBrowse,
} from "@nextpress/shared/media";
import { useId, useRef, type ReactNode } from "react";
import {
  FaFilePdf,
  FaFolderOpen,
  FaList,
  FaSortAmountDownAlt,
  FaSortAmountUpAlt,
  FaThLarge,
} from "react-icons/fa";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";
import { AdminTimestamp } from "@/lib/settings/admin-date-time";
import { ToolbarSearch } from "@/ui/components/DataList/ToolbarSearch";
import { useTextOverflow } from "@/ui/components/TruncatedText/useTextOverflow";
import {
  AdminButton,
  AdminIconButton,
  AdminToggleButton,
  Select,
} from "@/ui/primitives";
import { Tooltip } from "@/ui/primitives/Tooltip/Tooltip";

import styles from "./MediaBrowser.module.css";
import { MediaThumbnail } from "../MediaThumbnail";
import { MediaUploads } from "../MediaUploads/MediaUploads";
import { useMediaMessages } from "../messages";

export const initialMediaQuery = MediaBrowseSchema.parse({});

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

function MediaAssetButton({
  className,
  pressed,
  onClick,
  label,
  filename,
  list,
  thumbnail,
  children,
}: {
  className: string;
  pressed?: boolean;
  onClick: () => void;
  label: string;
  filename?: string;
  list: boolean;
  thumbnail: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const { ref: titleRef, truncated: titleTruncated } = useTextOverflow(label);
  const { ref: filenameRef, truncated: filenameTruncated } = useTextOverflow(
    filename ?? "",
  );

  return (
    <Tooltip
      id={id}
      enabled={titleTruncated || filenameTruncated}
      touchPreview
      content={
        filename ? (
          <>
            {label}
            <br />
            {filename}
          </>
        ) : (
          label
        )
      }
    >
      <button
        type="button"
        className={className}
        aria-pressed={pressed}
        onClick={onClick}
      >
        <span
          className={
            list
              ? "grid grid-cols-[3rem_minmax(0,1fr)] items-center gap-3"
              : "grid grid-cols-[minmax(0,1fr)] gap-2"
          }
        >
          {thumbnail}
          <span className="min-w-0 wrap-anywhere">
            <span ref={titleRef} className="admin-ellipsis">
              {label}
            </span>
            {filename && (
              <small ref={filenameRef} className="admin-ellipsis">
                {filename}
              </small>
            )}
            {children}
          </span>
        </span>
      </button>
    </Tooltip>
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
  const filtersRef = useRef<HTMLFormElement>(null);
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

  function applyFilterSelection() {
    const form = filtersRef.current;

    if (form) {
      submitFilters(form);
    }
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
      <div className={styles.surface}>
        <form
          ref={filtersRef}
          key={params.toString()}
          className={`admin-filter-toolbar ${styles.toolbar}`}
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            submitFilters(event.currentTarget);
          }}
        >
          <ToolbarSearch
            name="q"
            aria-label={text.search}
            defaultValue={query.q}
            maxLength={100}
            placeholder={text.search}
            submitLabel={text.searchButton}
          />
          {!documents && (
            <Select
              id="media-format"
              name="mime"
              aria-label={text.format}
              defaultValue={query.mime ?? ""}
              className="select-sm"
              options={[
                { value: "", label: all ? text.allFiles : text.any },
                ...MediaInputMimeSchema.options.map((mime) => ({
                  value: mime,
                  label: mime.slice(6).toUpperCase(),
                })),
                ...(all ? [{ value: documentMime, label: "PDF" }] : []),
              ]}
              onChangeAction={applyFilterSelection}
            />
          )}
          <div className={styles.sortGroup} role="group" aria-label={text.sort}>
            <Select
              id="media-sort"
              name="sort"
              aria-label={text.sort}
              defaultValue={query.sort}
              className="select-sm"
              options={[
                { value: "createdAt", label: text.createdAt },
                { value: "updatedAt", label: text.updatedAt },
                { value: "filename", label: text.filename },
                { value: "size", label: text.size },
              ]}
              onChangeAction={applyFilterSelection}
            />
            <AdminIconButton
              icon={
                query.direction === "asc"
                  ? FaSortAmountUpAlt
                  : FaSortAmountDownAlt
              }
              iconSize={18}
              variant="ghost"
              className="admin-plain-icon-button"
              aria-label={query.direction === "asc" ? text.newest : text.oldest}
              title={query.direction === "asc" ? text.newest : text.oldest}
              onClick={() =>
                onQuery({
                  ...query,
                  direction: query.direction === "asc" ? "desc" : "asc",
                  page: 1,
                })
              }
            />
          </div>
          {onView && (
            <div
              className={styles.viewGroup}
              role="group"
              aria-label={text.view}
            >
              <AdminToggleButton
                icon={FaThLarge}
                iconSize={18}
                variant="ghost"
                className="admin-plain-icon-button"
                pressed={view === "grid"}
                aria-label={text.grid}
                title={text.grid}
                onClick={() => onView("grid")}
              />
              <AdminToggleButton
                icon={FaList}
                iconSize={18}
                variant="ghost"
                className="admin-plain-icon-button"
                pressed={view === "list"}
                aria-label={text.list}
                title={text.list}
                onClick={() => onView("list")}
              />
            </div>
          )}
        </form>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 p-3 sm:p-4">
          {error && (
            <div className="flex flex-wrap items-center gap-2">
              <p role="alert">{text.loadError}</p>
              <AdminButton
                type="button"
                variant="outline"
                onClick={() => void mutate()}
              >
                {text.retry}
              </AdminButton>
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
                    <MediaAssetButton
                      pressed={library ? undefined : active}
                      onClick={() => onAsset(asset)}
                      label={isDocument ? asset.caption || name : name}
                      filename={isDocument && asset.caption ? name : undefined}
                      list={view === "list"}
                      thumbnail={
                        isDocument ? (
                          <FaFilePdf aria-hidden="true" />
                        ) : (
                          <MediaThumbnail asset={{ ...asset, alt: "" }} />
                        )
                      }
                      className={`w-full rounded-lg border p-2 text-start hover:bg-base-200 focus-visible:outline-2 focus-visible:outline-primary ${active ? "border-primary bg-base-200" : "border-base-300"}`}
                    >
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
                    </MediaAssetButton>
                  </li>
                );
              })}
            </ul>
          )}
          {(query.page > 1 || data?.hasMore) && (
            <div className="flex flex-wrap items-center gap-2">
              <AdminButton
                type="button"
                variant="outline"
                disabled={query.page <= 1}
                onClick={() => onQuery({ ...query, page: query.page - 1 })}
              >
                {text.previous}
              </AdminButton>
              <span>
                {text.page} {query.page}
              </span>
              <AdminButton
                type="button"
                variant="outline"
                disabled={!data?.hasMore}
                onClick={() => onQuery({ ...query, page: query.page + 1 })}
              >
                {text.next}
              </AdminButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
