"use client";

import {
  isPagePath,
  maxPageDepth,
  pageLayouts,
} from "@nextpress/shared/content";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";

import { ApiRequestError, apiFetch, jsonResult } from "@/lib/api";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { TruncatedText } from "@/ui/components/TruncatedText/TruncatedText";
import { AdminButton, Input, Select } from "@/ui/primitives";

type HierarchyPage = z.infer<typeof page>;
const page = z.object({
  id: z.string(),
  title: z.string(),
  slug: z.string(),
  layout: z.string(),
  parentId: z.string().nullable(),
  siblingOrder: z.number().int(),
});
const hierarchy = z.array(page);
const endpoint = "/api/admin/page-hierarchy";

function lineage(id: string | null, pages: HierarchyPage[]) {
  const result: HierarchyPage[] = [];

  while (id && result.length < maxPageDepth) {
    const ancestor = pages.find((entry) => entry.id === id);

    if (!ancestor || result.some((entry) => entry.id === id)) {
      break;
    }

    result.unshift(ancestor);
    id = ancestor.parentId;
  }

  return result;
}

export function PageHierarchy({
  id,
  pendingSlug,
}: {
  id?: string;
  pendingSlug?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [pages, setPages] = useState<HierarchyPage[] | null>(null);
  const [selected, setSelected] = useState(id ?? "");
  const [failure, setFailure] = useState<"failed" | "unauthorized" | null>(
    null,
  );
  const summary = useRef<HTMLElement>(null);
  const hu = useAdminLocale() === "hu";

  useEffect(() => {
    if (!attempt) {
      return;
    }

    const controller = new AbortController();

    async function load() {
      const [data, error] = await jsonResult<unknown>(endpoint, {
        signal: controller.signal,
      });

      if (controller.signal.aborted) {
        return;
      }

      const parsed = hierarchy.safeParse(data);

      if (!error && parsed.success) {
        setPages(parsed.data);
      } else if (
        error instanceof ApiRequestError &&
        [401, 403].includes(error.status)
      ) {
        setFailure("unauthorized");
      } else {
        setFailure("failed");
      }
    }

    void load();

    return () => controller.abort();
  }, [attempt]);

  function retry() {
    summary.current?.focus();
    setFailure(null);
    setAttempt(attempt + 1);
  }

  const current = pages?.find((entry) => entry.id === selected);

  return (
    <details
      className="admin-surface admin-hierarchy-panel"
      onToggle={(event) => {
        if (event.currentTarget.open && !attempt) {
          setAttempt(1);
        }
      }}
    >
      <summary ref={summary} className="admin-hierarchy-heading">
        {hu ? "Oldalhierarchia" : "Page hierarchy"}
      </summary>
      <div className="admin-hierarchy-content">
        {failure && (
          <p role="alert">
            {failure === "unauthorized"
              ? hu
                ? "Nincs jogosultsága az oldalhierarchia megtekintéséhez."
                : "You do not have access to the Page hierarchy."
              : hu
                ? "Az oldalhierarchia nem tölthető be."
                : "Unable to load Page hierarchy."}
          </p>
        )}
        {failure === "failed" && (
          <AdminButton onClick={retry}>
            {hu ? "Újrapróbálkozás" : "Retry"}
          </AdminButton>
        )}
        {!!attempt && (
          <p role="status">
            {!pages &&
              !failure &&
              (hu ? "Oldalhierarchia betöltése…" : "Loading Page hierarchy…")}
            {pages?.length === 0 &&
              (hu ? "Nincsenek elérhető oldalak." : "No Pages found.")}
          </p>
        )}
        {!!pages?.length && !id && (
          <Select
            label="Page"
            value={selected}
            onChangeAction={setSelected}
            options={[
              { value: "", label: "Select a Page" },
              ...pages.map((entry) => ({
                value: entry.id,
                label: lineage(entry.id, pages)
                  .map(({ title }) => title)
                  .join(" / "),
              })),
            ]}
          />
        )}
        {current && pages && (
          <HierarchyFields
            key={current.id}
            pendingSlug={pendingSlug}
            current={current}
            pages={pages}
            onSaved={(updated) =>
              setPages(
                pages.map((entry) =>
                  entry.id === updated.id ? updated : entry,
                ),
              )
            }
          />
        )}
      </div>
    </details>
  );
}

function HierarchyFields({
  pendingSlug,
  current,
  pages,
  onSaved,
}: {
  pendingSlug?: string;
  current: HierarchyPage;
  pages: HierarchyPage[];
  onSaved: (page: HierarchyPage) => void;
}) {
  const [parentId, setParentId] = useState(current.parentId ?? "");
  const [order, setOrder] = useState(String(current.siblingOrder));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const parents = pages.filter(
    (candidate) =>
      !lineage(candidate.id, pages).some(({ id }) => id === current.id),
  );
  const children = pages
    .filter((candidate) => candidate.parentId === current.id)
    .sort(
      (left, right) =>
        left.siblingOrder - right.siblingOrder ||
        left.id.localeCompare(right.id),
    );
  const segments = [
    ...lineage(parentId, pages).map(({ slug }) => slug),
    pendingSlug || current.slug,
  ];
  const path =
    current.layout === pageLayouts.home
      ? "/"
      : isPagePath(segments)
        ? `/${segments.join("/")}`
        : `/pages/${segments.at(-1)}`;

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: current.id,
          parentId: parentId || null,
          siblingOrder: Number(order),
          previousParentId: current.parentId,
          previousSiblingOrder: current.siblingOrder,
        }),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        const parsed = z.object({ error: z.string() }).safeParse(result);
        throw new Error(
          parsed.success ? parsed.data.error : "Unable to save hierarchy.",
        );
      }

      const saved = page
        .pick({ id: true, parentId: true, siblingOrder: true })
        .parse(result);

      onSaved({ ...current, ...saved });
      setMessage("Page hierarchy saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to save hierarchy.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <fieldset className="space-y-3 py-3" disabled={busy}>
      <Select
        disabled={current.layout === pageLayouts.home}
        label="Parent Page"
        value={parentId}
        onChangeAction={setParentId}
        options={[
          { value: "", label: "Top level" },
          ...parents.map((entry) => ({
            value: entry.id,
            label: lineage(entry.id, pages)
              .map(({ title }) => title)
              .join(" / "),
          })),
        ]}
      />
      <Input
        aria-label="Sibling order"
        type="number"
        min={0}
        max={1000000}
        step={1}
        value={order}
        onChange={(event) => setOrder(event.target.value)}
      />
      <div className="flex min-w-0 gap-2">
        <span className="shrink-0">Page path</span>
        <TruncatedText value={path} className="font-mono" />
      </div>
      <AdminButton
        disabled={
          !order ||
          !/^\d+$/.test(order) ||
          (parentId === (current.parentId ?? "") &&
            Number(order) === current.siblingOrder)
        }
        onClick={() => void save()}
      >
        Save hierarchy
      </AdminButton>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      <h3 className="font-medium">Child Pages</h3>
      {children.length ? (
        <ul className="list-disc pl-5">
          {children.map((child) => (
            <li key={child.id}>
              <TruncatedText
                href={`/admin/pages/${child.id}`}
                className="underline"
                value={child.title}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p>No child Pages.</p>
      )}
    </fieldset>
  );
}
