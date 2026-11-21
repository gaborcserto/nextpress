"use client";

import { useEffect, useMemo, useState } from "react";

import type { TagLoadOptionsFn, TagValue } from "./TagMultiSelect.types";

/**
 * Encapsulates debounced async tag search logic.
 */
export function useTagMultiSelectSearch(
  query: string,
  loadOptions: TagLoadOptionsFn,
  minChars = 2,
) {
  const search = useMemo(
    () => ({ query, loadOptions, minChars }),
    [query, loadOptions, minChars],
  );
  const [result, setResult] = useState<{
    search: typeof search;
    options: TagValue[];
    error: string | null;
  } | null>(null);
  const canSearch = query.trim().length >= minChars;
  const current = canSearch && result?.search === search ? result : null;

  useEffect(() => {
    const trimmed = search.query.trim();

    if (trimmed.length < search.minChars) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const options = await search.loadOptions(trimmed, controller.signal);

        if (!controller.signal.aborted) {
          setResult({ search, options, error: null });
        }
      } catch {
        if (!controller.signal.aborted) {
          setResult({
            search,
            options: [],
            error: "Unable to search tags. Please try again.",
          });
        }
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [search]);

  return {
    options: current?.options ?? [],
    loading: canSearch && !current,
    error: current?.error ?? null,
  };
}
