"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import useSWR from "swr";

import { jsonFetcher } from "@/lib/api";

import type { ContentListSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";

export type ContentListResponse = z.infer<typeof ContentListSchema>;
export type ContentPagination = {
  page: number;
  metadata?: Pick<ContentListResponse, "page" | "limit" | "total" | "pages">;
  busy: boolean;
  hasNextPage: boolean;
  onPageAction: (page: number) => void;
};

// Match the existing API pagination bound; never forward an unbounded URL value.
const MAX_PAGE = 10_000;

export function useContentList(endpoint: string) {
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

  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ContentListResponse>(`${endpoint}?page=${page}`, jsonFetcher, {
      keepPreviousData: false,
    });
  const lastPage = data ? Math.max(1, Math.min(data.pages, MAX_PAGE)) : page;
  const correcting = Boolean(data && page > lastPage);

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

  return {
    items: correcting ? [] : (data?.items ?? []),
    error,
    isLoading: isLoading || correcting,
    mutate,
    pagination: {
      page,
      metadata: correcting ? undefined : data,
      busy: isLoading || isValidating || correcting,
      hasNextPage: Boolean(data && page < lastPage),
      onPageAction,
    } satisfies ContentPagination,
  };
}
