"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ConfirmDialog } from "@/ui/primitives/ConfirmDialog";

/** Cache immutable subtrees so typing a title does not serialize the document again. */
function stableValue(value: unknown, cache: WeakMap<object, string>): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }

  const previous = cache.get(value);

  if (previous !== undefined) {
    return previous;
  }

  let result: string;

  if (Array.isArray(value)) {
    const nodes: unknown[] = [];

    for (const item of value) {
      const last = nodes[nodes.length - 1];

      if (
        item &&
        typeof item === "object" &&
        "text" in item &&
        typeof item.text === "string" &&
        last &&
        typeof last === "object" &&
        "text" in last &&
        typeof last.text === "string" &&
        stableValue({ ...item, text: "" }, cache) ===
          stableValue({ ...last, text: "" }, cache)
      ) {
        nodes[nodes.length - 1] = { ...last, text: last.text + item.text };
      } else {
        nodes.push(item);
      }
    }

    result = `[${nodes.map((item) => stableValue(item, cache)).join(",")}]`;
  } else {
    result = `{${Object.entries(value)
      .filter(
        ([key, field]) =>
          field !== undefined &&
          field !== null &&
          !(
            field === false &&
            ["bold", "italic", "underline", "strikethrough", "code"].includes(
              key,
            )
          ) &&
          !(key === "align" && field === "left") &&
          !(key === "level" && "type" in value && value.type !== "heading"),
      )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, field]) => {
        const date =
          typeof field === "string" &&
          ["publishedAt", "eventStart", "eventEnd"].includes(key)
            ? new Date(field)
            : null;
        const normalized =
          date && !Number.isNaN(date.getTime()) ? date.toISOString() : field;

        return `${JSON.stringify(key)}:${stableValue(normalized, cache)}`;
      })
      .join(",")}}`;
  }

  cache.set(value, result);

  return result;
}

function editorSnapshot(
  { tags, ...fields }: { tags: unknown },
  persistedTags: boolean,
  cache: WeakMap<object, string>,
): string {
  return stableValue(persistedTags ? fields : { ...fields, tags }, cache);
}

/** Mount only after authoritative initial data is ready; reset only on accepted writes. */
export function useUnsavedChanges<T extends { tags: unknown }>(
  values: T,
  persistedTags: boolean,
  dirtyOverride?: boolean,
) {
  const router = useRouter();
  const [cache] = useState(() => new WeakMap<object, string>());
  const snapshot = useMemo(
    () => editorSnapshot(values, persistedTags, cache),
    [values, persistedTags, cache],
  );
  const [baseline, setBaseline] = useState(snapshot);
  const dirty = dirtyOverride ?? snapshot !== baseline;
  const [open, setOpen] = useState(false);
  const leaving = useRef(false);
  const destination = useRef<(() => void) | null>(null);

  useEffect(() => {
    leaving.current = false;
  }, [snapshot]);

  const requestNavigation = (action: () => void) => {
    if (!dirty) {
      action();

      return;
    }

    if (destination.current) {
      return;
    }

    destination.current = action;
    setOpen(true);
  };

  useEffect(() => {
    if (!dirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    const intercept = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;

      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== "_self")
      ) {
        return;
      }

      const url = new URL(anchor.href);

      if (
        url.origin !== location.origin ||
        (url.pathname === location.pathname && url.search === location.search)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (destination.current) {
        return;
      }

      destination.current = () =>
        router.push(url.pathname + url.search + url.hash);
      setOpen(true);
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", intercept, true);

    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", intercept, true);
    };
  }, [dirty, router]);

  const stay = () => {
    destination.current = null;
    setOpen(false);
  };

  const leave = () => {
    const action = destination.current;
    destination.current = null;
    setOpen(false);
    leaving.current = true;
    action?.();
  };

  return {
    dirty,
    markSaved: (saved?: T) =>
      setBaseline(
        saved ? editorSnapshot(saved, persistedTags, cache) : snapshot,
      ),
    requestNavigation,
    dialog: (
      <ConfirmDialog
        open={open}
        title="Discard unsaved changes?"
        cancelLabel="Stay and edit"
        confirmLabel="Discard and leave"
        confirmColor="error"
        onCancelAction={stay}
        onConfirmAction={leave}
      >
        Your unsaved changes will be lost.
        {dirtyOverride !== undefined &&
          " An outstanding private save may still finish; reloading recovers the last persisted state."}
        {persistedTags && " Tags already saved are not undone."}
      </ConfirmDialog>
    ),
  };
}
