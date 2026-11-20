"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import useSWR, { useSWRConfig } from "swr";

import { jsonFetcher } from "@/lib/api";

import type {
  ContentListSchema,
  ListPaginationSchema,
} from "@nextpress/shared/api-contracts";
import type { z } from "zod";

export type ContentListResponse = z.infer<typeof ContentListSchema>;
type ListPagination = z.infer<typeof ListPaginationSchema>;
export type ContentListQuery = {
  values: URLSearchParams;
  onApplyAction: (filters: FormData) => void;
};
export type ContentPagination = {
  page: number;
  metadata?: ListPagination;
  busy: boolean;
  hasNextPage: boolean;
  onPageAction: (page: number) => void;
};

// Match the existing API pagination bound; never forward an unbounded URL value.
const MAX_PAGE = 10_000;

export function useContentList<Item = ContentListResponse["items"][number]>(
  endpoint: string,
  fetcher: (
    url: string,
  ) => Promise<ListPagination & { items: Item[] }> = jsonFetcher,
  shouldRetryOnError?: (error: Error) => boolean,
  filterKeys: readonly string[] = [
    "q",
    "status",
    "sort",
    "direction",
    "pageType",
    "tag",
    "category",
  ],
  defaults?: Record<string, string>,
) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const query = params.toString();
  const values = params.getAll("page");
  const raw = values[0];
  const parsed = raw && /^\d+$/.test(raw) ? Number(raw) : NaN;
  const valid =
    values.length === 1 &&
    Number.isSafeInteger(parsed) &&
    parsed >= 1 &&
    parsed <= MAX_PAGE;
  const page = valid ? parsed : 1;
  const navigatingTo = useRef<string | null>(null);

  const pageUrl = useCallback(
    (nextPage: number) => {
      const next = new URLSearchParams(query);
      next.delete("page");

      if (nextPage > 1) {
        next.set("page", String(nextPage));
      }

      const search = next.toString();

      return pathname + (search ? `?${search}` : "");
    },
    [pathname, query],
  );

  const request = new URLSearchParams({ page: String(page), ...defaults });

  for (const key of filterKeys) {
    const selected = params.getAll(key);

    if (selected.length) {
      request.delete(key);
    }

    for (const value of selected) {
      request.append(key, value);
    }
  }

  const key = endpoint + "?" + request;
  const { cache } = useSWRConfig();
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    key,
    fetcher,
    {
      keepPreviousData: true,
      ...(shouldRetryOnError && { shouldRetryOnError }),
    },
  );
  const metadata =
    isLoading || (error && !cache.get(key)?.data) ? undefined : data;
  const lastPage = metadata
    ? Math.max(1, Math.min(metadata.pages, MAX_PAGE))
    : page;

  const correcting = Boolean(metadata && page > lastPage);

  useEffect(() => {
    navigatingTo.current = null;
  }, [query]);

  useEffect(() => {
    if (correcting) {
      router.replace(pageUrl(lastPage), { scroll: false });
    } else if (
      values.length > 0 &&
      (!valid || raw !== String(page) || page === 1)
    ) {
      router.replace(pageUrl(page), { scroll: false });
    }
  }, [correcting, lastPage, page, pageUrl, raw, router, valid, values.length]);

  const onPageAction = (nextPage: number) => {
    if (
      isLoading ||
      isValidating ||
      correcting ||
      nextPage === page ||
      nextPage < 1 ||
      nextPage > lastPage
    ) {
      return;
    }

    const url = pageUrl(nextPage);

    if (navigatingTo.current !== null) {
      return;
    }

    navigatingTo.current = url;
    router.push(url, { scroll: false });
  };

  function onApplyAction(filters: FormData) {
    const next = new URLSearchParams(query);

    for (const key of filterKeys) {
      next.delete(key);
      const value = filters.get(key);

      if (typeof value === "string" && value.trim()) {
        next.set(key, value.trim());
      }
    }

    const current = new URLSearchParams(query);
    const updated = new URLSearchParams(next);
    updated.sort();
    current.sort();

    if (updated.toString() !== current.toString()) {
      next.delete("page");
      const search = next.toString();

      router.push(pathname + (search ? "?" + search : ""), { scroll: false });
    }
  }

  return {
    query: { values: request, onApplyAction } satisfies ContentListQuery,
    items: correcting ? [] : (data?.items ?? []),
    error,
    isLoading: isLoading || correcting,
    mutate,
    pagination: {
      page,
      metadata: correcting ? undefined : metadata,
      busy: isLoading || isValidating || correcting,
      hasNextPage: Boolean(metadata && page < lastPage),
      onPageAction,
    } satisfies ContentPagination,
  };
}
