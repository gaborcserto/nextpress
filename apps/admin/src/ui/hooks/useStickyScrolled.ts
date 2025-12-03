import { useEffect, useState } from "react";

import type { RefObject } from "react";

/**
 * Detects whether a scrollable element is scrolled past the top.
 * Useful for frosted headers, sticky toolbars, etc.
 */
export function useStickyScrolled(ref?: RefObject<HTMLElement | null>) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = ref?.current || window;
    const onScroll = () => {
      const offset = ref?.current?.scrollTop ?? window.scrollY;
      setScrolled(offset > 4);
    };
    onScroll();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [ref]);

  return scrolled;
}
