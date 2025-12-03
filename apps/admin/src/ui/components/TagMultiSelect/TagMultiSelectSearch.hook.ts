"use client";

import { useEffect, useState } from "react";

import type { TagLoadOptionsFn, TagValue } from "./TagMultiSelect.types";

/**
 * Encapsulates debounced async tag search logic.
 */
export function useTagMultiSelectSearch(
  query: string,
  loadOptions: TagLoadOptionsFn
) {
  const [options, setOptions] = useState<TagValue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();

    if (!trimmed) {
      setOptions([]);
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
  }, [query, loadOptions]);

  return { options, loading, setOptions };
}
