"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import styles from "./BlogNavigation.module.css";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

type IndicatorGeometry = {
  pathname: string;
  viewportWidth: number;
  panelWidth: number;
  width: string;
  transform: string;
};

declare global {
  interface Window {
    __nextpressBlogNavigationIndicator?: IndicatorGeometry;
  }
}

export function BlogNavigation({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // SSR exposes the links as a meaningful fallback until enhancement runs.
  const [desktop, setDesktop] = useState(true);
  const [open, setOpen] = useState(false);
  const [previousPath, setPreviousPath] = useState(pathname);
  const button = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const id = useId();
  const pendingFocus = useRef<"toggle" | "link" | null>(null);

  if (pathname !== previousPath) {
    setPreviousPath(pathname);
    setOpen(false);
  }

  useLayoutEffect(() => {
    const panel = navigation.current;
    const line = indicator.current;

    if (!panel || !line || !desktop) {
      return;
    }

    let frame = 0;

    function enableAfterPaint() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (line) {
            line.dataset.animate = "true";
          }
        });
      });
    }

    function measure(resizing = false) {
      if (!panel || !line) {
        return;
      }

      const active = panel.querySelector('a[aria-current="page"]');
      const bounds = panel.getBoundingClientRect();
      const target = active?.getBoundingClientRect();
      panel.dataset.indicator = target ? "true" : "false";

      if (!target) {
        return;
      }

      const previous = window.__nextpressBlogNavigationIndicator ?? null;
      const shouldSlide =
        !resizing &&
        desktop &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        previous !== null &&
        previous.pathname !== pathname &&
        previous.viewportWidth === window.innerWidth &&
        previous.panelWidth === bounds.width;
      line.dataset.animate = "false";
      if (shouldSlide) {
        const targetWidth = `${target.width}px`;
        const targetTransform = `translate(${target.left - bounds.left}px, ${target.bottom - bounds.top}px)`;

        line.style.width = targetWidth;
        line.style.transform = targetTransform;
        line.animate(
          [
            { width: previous.width, transform: previous.transform },
            { width: targetWidth, transform: targetTransform },
          ],
          { duration: 200, easing: "ease" },
        );
      } else {
        line.style.width = `${target.width}px`;
        line.style.transform = `translate(${target.left - bounds.left}px, ${target.bottom - bounds.top}px)`;
        enableAfterPaint();
      }

      window.__nextpressBlogNavigationIndicator = {
        pathname,
        viewportWidth: window.innerWidth,
        panelWidth: bounds.width,
        width: `${target.width}px`,
        transform: `translate(${target.left - bounds.left}px, ${target.bottom - bounds.top}px)`,
      };
    }

    measure();
    let firstObservation = true;
    const observer = new ResizeObserver(() => {
      // The initial observer delivery must not cancel an in-flight route transition.
      if (firstObservation) {
        firstObservation = false;

        return;
      }

      measure(true);
    });
    observer.observe(panel);
    panel.querySelectorAll("a").forEach((link) => observer.observe(link));

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [pathname, desktop, children]);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 56rem)");

    function updateLayout() {
      if (
        !query.matches &&
        navigation.current?.contains(document.activeElement)
      ) {
        pendingFocus.current = "toggle";
      }
      if (query.matches && document.activeElement === button.current) {
        pendingFocus.current = "link";
      }

      setDesktop(query.matches);
      setOpen(false);
    }

    updateLayout();
    query.addEventListener("change", updateLayout);

    return () => {
      query.removeEventListener("change", updateLayout);
    };
  }, []);

  useEffect(() => {
    if (pendingFocus.current === "toggle") {
      button.current?.focus();
    }
    if (pendingFocus.current === "link") {
      navigation.current?.querySelector("a")?.focus();
    }

    pendingFocus.current = null;
  }, [desktop]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      setOpen(false);
      button.current?.focus();
    }
  }

  function handleNavigation(event: MouseEvent<HTMLElement>) {
    const link =
      event.target instanceof Element ? event.target.closest("a") : null;

    if (!link) {
      return;
    }

    setOpen(false);
  }

  return (
    <div
      className={styles.disclosure}
      data-mobile={!desktop}
      data-open={open}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={button}
        className={styles.toggle}
        type="button"
        hidden={desktop}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span className={styles.strokes} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <nav
        ref={navigation}
        id={id}
        className={styles.panel}
        aria-label="Primary"
        inert={!desktop && !open}
        aria-hidden={!desktop && !open ? true : undefined}
        onClick={handleNavigation}
      >
        {children}
        <span ref={indicator} className={styles.indicator} aria-hidden="true" />
      </nav>
    </div>
  );
}
