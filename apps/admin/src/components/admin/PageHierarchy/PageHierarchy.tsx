"use client";

import {
  isPagePath,
  maxPageDepth,
  pageLayouts,
} from "@nextpress/shared/content";
import Link from "next/link";
import { useEffect, useState } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { Button, Input, Select } from "@/ui/primitives";

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
  const [requested, setRequested] = useState(false);
  const [pages, setPages] = useState<HierarchyPage[] | null>(null);
  const [selected, setSelected] = useState(id ?? "");
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!requested) {
      return;
    }

    const controller = new AbortController();

    async function load() {
      try {
        const response = await apiFetch(endpoint, {
          signal: controller.signal,
        });

        if (response.status === 403) {
          setHidden(true);

          return;
        }

        if (!response.ok) {
          throw new Error("Unable to load Page hierarchy.");
        }

        setPages(hierarchy.parse(await response.json()));
      } catch {
        if (!controller.signal.aborted) {
          setError("Unable to load Page hierarchy.");
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [requested]);

  if (hidden) {
    return null;
  }

  const current = pages?.find((entry) => entry.id === selected);

  return (
    <details
      className="rounded border border-current/20 p-4"
      onToggle={(event) => {
        if (event.currentTarget.open) {
          setRequested(true);
        }
      }}
    >
      <summary className="cursor-pointer font-semibold">Page hierarchy</summary>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        requested && !pages && <p role="status">Loading Page hierarchy…</p>
      )}
      {pages && !id && (
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
              pages.map((entry) => (entry.id === updated.id ? updated : entry)),
            )
          }
        />
      )}
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
      <p>
        Page path <code>{path}</code>
      </p>
      <Button
        disabled={
          !order ||
          !/^\d+$/.test(order) ||
          (parentId === (current.parentId ?? "") &&
            Number(order) === current.siblingOrder)
        }
        onClick={() => void save()}
      >
        Save hierarchy
      </Button>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      <h3 className="font-medium">Child Pages</h3>
      {children.length ? (
        <ul className="list-disc pl-5">
          {children.map((child) => (
            <li key={child.id}>
              <Link href={`/admin/pages/${child.id}`} className="underline">
                {child.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p>No child Pages.</p>
      )}
    </fieldset>
  );
}
