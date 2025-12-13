"use client";

import { useEffect, useState } from "react";

import type { TagLoadOptionsFn, TagValue } from "./TagMultiSelect.types";

/**
 * Encapsulates debounced async tag search logic.
 */
export function useTagMultiSelectSearch(
  query: string,
  loadOptions: TagLoadOptionsFn,
  minChars = 2
) {
  const [options, setOptions] = useState<TagValue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    // Avoid hitting the API for very short queries.
    if (trimmed.length < minChars) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await loadOptions(trimmed);
        if (!cancelled) setOptions(result);
      } catch {
        if (!cancelled) setOptions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, loadOptions, minChars]);

  return { options, loading, setOptions };
}
