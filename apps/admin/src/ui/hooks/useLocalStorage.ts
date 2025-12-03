"use client";

import { useEffect, useState } from "react";

/**
 * A safe & SSR-friendly localStorage hook.
 *
 * - Reads the initial value inside `useState` using a lazy initializer.
 * - Falls back to `defaultValue` during SSR or when parsing fails.
 * - Syncs changes back to localStorage with a single effect.
 * - No `setState` inside effects → works with strict ESLint rules.
 */
export function useLocalStorage<T>(key: string, defaultValue: T) {
  // Initialize from localStorage (if available) — lazy initializer avoids hydration issues
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return defaultValue; // SSR / no window → return fallback
    }

    try {
      const json = window.localStorage.getItem(key);
      if (json != null) {
        return JSON.parse(json) as T;
      }
    } catch {
      // Ignore JSON parse / localStorage access errors
    }

    return defaultValue;
  });

  // Sync updates back into localStorage after initial load
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota / serialization errors
    }
  }, [key, value]);

  // return a tuple to mirror useState
  return [value, setValue] as const;
}
