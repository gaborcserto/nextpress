"use client";

import { useLayoutEffect, useRef, useState } from "react";

const measurements = new Map<Element, () => void>();
let observer: ResizeObserver | undefined;

export function useTextOverflow(value: string) {
  const ref = useRef<HTMLSpanElement>(null);
  const [truncated, setTruncated] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    function measure(target: HTMLElement) {
      setTruncated(target.scrollWidth > target.clientWidth);
    }

    measure(element);

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    observer ??= new ResizeObserver((entries) => {
      for (const { target } of entries) {
        measurements.get(target)?.();
      }
    });
    measurements.set(element, () => measure(element));
    observer.observe(element);

    return () => {
      observer?.unobserve(element);
      measurements.delete(element);

      if (!measurements.size) {
        observer?.disconnect();
        observer = undefined;
      }
    };
  }, [value]);

  return { ref, truncated };
}
