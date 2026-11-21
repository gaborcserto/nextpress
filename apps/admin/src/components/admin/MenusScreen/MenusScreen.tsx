"use client";

import {
  maxMenuDepth,
  maxMenuItems,
  NavigationItemSchema,
  NavigationLocationSchema,
  NavigationMenuListSchema,
} from "@nextpress/shared/api-contracts";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";

import { apiFetch } from "@/lib/api";
import { Button, Input, Select } from "@/ui/primitives";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";

import type {
  NavigationItemInput,
  NavigationMenuInput,
} from "@nextpress/shared/api-contracts";

type Menu = z.infer<typeof NavigationMenuListSchema>[number];

const endpoint = "/api/admin/navigation";
const emptyMenu: NavigationMenuInput = { name: "", locations: [], items: [] };
const errorBody = z.object({ error: z.string() });
const contentResults = z.object({
  items: z.array(z.object({ id: z.string(), title: z.string() })),
});
const taxonomyResults = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

function ancestors(item: NavigationItemInput, items: NavigationItemInput[]) {
  const result: string[] = [];
  let parent = item.parentId;

  while (parent && result.length < maxMenuDepth && !result.includes(parent)) {
    result.push(parent);
    parent = items.find(({ id }) => id === parent)?.parentId ?? null;
  }

  return result;
}

async function readMenus() {
  const response = await apiFetch(endpoint, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load menus.");
  }

  return NavigationMenuListSchema.parse(await response.json());
}

export function MenusScreen() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [search, setSearch] = useState("");
  const [taxonomies, setTaxonomies] = useState<{ id: string; title: string }[]>(
    [],
  );
  const focusTarget = useRef<string | null>(null);
  const [selected, setSelected] = useState("");
  const [draft, setDraft] = useState(emptyMenu);
  const [destinations, setDestinations] = useState<
    { id: string; title: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [destinationError, setDestinationError] = useState(false);
  const saved = menus.find(({ id }) => selected === id);
  const baseline = saved
    ? { name: saved.name, locations: saved.locations, items: saved.items }
    : emptyMenu;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    let active = true;

    void readMenus()
      .then((data) => {
        if (active) {
          setMenus(data);
        }
      })
      .catch(() => {
        if (active) {
          setError("Unable to load menus.");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDestinations() {
      const query = new URLSearchParams({ limit: "100" });

      if (search.trim()) {
        query.set("q", search.trim());
      }

      try {
        const paths = [
          `pages?${query}`,
          `post?${query}`,
          `admin/tags?${query}&type=CATEGORY`,
          `admin/tags?${query}&type=TAG`,
        ];
        const [pages, posts, categories, tags] = await Promise.all(
          paths.map(async (path) => {
            const response = await apiFetch(`/api/${path}`, {
              signal: controller.signal,
            });

            if (!response.ok) {
              throw new Error("Unable to load menu destinations");
            }

            return response.json();
          }),
        );

        if (!controller.signal.aborted) {
          setDestinations([
            ...contentResults.parse(pages).items,
            ...contentResults.parse(posts).items,
          ]);
          setTaxonomies(
            [
              ...taxonomyResults.parse(categories).items,
              ...taxonomyResults.parse(tags).items,
            ].map(({ id, name }) => ({ id, title: name })),
          );
          setDestinationError(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setDestinationError(true);
        }
      }
    }

    const timer = window.setTimeout(() => void loadDestinations(), 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  useLayoutEffect(() => {
    if (focusTarget.current) {
      document.getElementById(focusTarget.current)?.focus();
      focusTarget.current = null;
    }
  }, [draft.items]);

  function selectMenu(id: string, available = menus) {
    const menu = available.find((entry) => entry.id === id);
    setSelected(menu?.id ?? "");
    setDraft(
      menu
        ? { name: menu.name, locations: menu.locations, items: menu.items }
        : emptyMenu,
    );
  }

  function patchItem(id: string, patch: Partial<NavigationItemInput>) {
    setDraft({
      ...draft,
      items: draft.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }

  function move(item: NavigationItemInput, direction: number) {
    const siblings = draft.items.filter(
      ({ parentId }) => parentId === item.parentId,
    );
    const destination =
      siblings.findIndex(({ id }) => id === item.id) + direction;
    const other = siblings[destination];

    if (!other) {
      return;
    }

    const items = draft.items.map((entry) => {
      if (entry.id === item.id) {
        return other;
      }

      return entry.id === other.id ? item : entry;
    });

    const moveFocus =
      destination === 0 || (direction > 0 && destination < siblings.length - 1)
        ? "down"
        : "up";
    focusTarget.current = `menu-${moveFocus}-${item.id}`;
    setDraft({ ...draft, items });
    setMessage(
      `Moved ${item.label || "item"} ${direction < 0 ? "up" : "down"}.`,
    );
  }

  async function persist(remove = false) {
    if (
      remove &&
      (!saved || !window.confirm(`Delete the menu “${saved.name}”?`))
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const body = saved
        ? {
            action: remove ? "delete" : "update",
            id: saved.id,
            version: saved.version,
            ...(!remove && { menu: draft }),
          }
        : { action: "create", menu: draft };

      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result: unknown = await response.json();

      if (!response.ok) {
        const parsed = errorBody.safeParse(result);
        throw new Error(
          parsed.success ? parsed.data.error : "The menu operation failed.",
        );
      }

      const { id } = z.object({ id: z.string() }).parse(result);
      const available = await readMenus();

      setMenus(available);
      selectMenu(remove ? "" : id, available);
      setMessage(remove ? "Menu deleted." : "Menu saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "The menu operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function renderItems(parentId: string | null) {
    const siblings = draft.items.filter((item) => item.parentId === parentId);

    if (!siblings.length) {
      return null;
    }

    return (
      <ul className="space-y-3 pl-3">
        {siblings.map((item, index) => {
          const parents = draft.items.filter(
            (candidate) =>
              candidate.id !== item.id &&
              !ancestors(candidate, draft.items).includes(item.id),
          );
          const choices = item.kind === "taxonomy" ? taxonomies : destinations;
          const descendants = draft.items.filter((entry) =>
            ancestors(entry, draft.items).includes(item.id),
          );
          const subtreeDepth = Math.max(
            1,
            ...descendants.map((entry) => {
              const path = ancestors(entry, draft.items);

              return path.indexOf(item.id) + 2;
            }),
          );

          return (
            <li key={item.id} className="rounded border border-current/20 p-3">
              <div className="flex flex-wrap gap-3">
                <Input
                  aria-label="Item label"
                  placeholder="Item label"
                  value={item.label}
                  onChange={(event) =>
                    patchItem(item.id, { label: event.target.value })
                  }
                />
                <Select
                  label="Destination type"
                  value={item.kind}
                  options={NavigationItemSchema.shape.kind.options.map(
                    (value) => ({ value, label: value }),
                  )}
                  onChangeAction={(value) =>
                    patchItem(item.id, {
                      kind: NavigationItemSchema.shape.kind.parse(value),
                      value: "",
                    })
                  }
                />
                {(item.kind === "content" || item.kind === "taxonomy") && (
                  <Select
                    label={
                      item.kind === "taxonomy"
                        ? "Category or Tag"
                        : "Page or Post"
                    }
                    placeholder="Select content"
                    value={item.value}
                    options={[
                      ...(!choices.some(({ id }) => id === item.value) &&
                      item.value
                        ? [{ value: item.value, label: "Existing reference" }]
                        : []),
                      ...choices.map(({ id, title }) => ({
                        value: id,
                        label: title,
                      })),
                    ]}
                    onChangeAction={(value) => patchItem(item.id, { value })}
                  />
                )}
                {(item.kind === "internal" || item.kind === "external") && (
                  <Input
                    aria-label="Link URL"
                    value={item.value}
                    onChange={(event) =>
                      patchItem(item.id, { value: event.target.value })
                    }
                  />
                )}
                <Select
                  label="Parent item"
                  id={`menu-parent-${item.id}`}
                  value={item.parentId ?? ""}
                  options={[
                    { value: "", label: "Top level" },
                    ...parents
                      .filter(
                        (parent) =>
                          ancestors(parent, draft.items).length + subtreeDepth <
                          maxMenuDepth,
                      )
                      .map((parent) => ({
                        value: parent.id,
                        label: parent.label || parent.value || "Untitled item",
                      })),
                  ]}
                  onChangeAction={(value) => {
                    focusTarget.current = `menu-parent-${item.id}`;
                    patchItem(item.id, { parentId: value || null });
                    setMessage("Item level changed.");
                  }}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={item.newTab}
                    onChange={(event) =>
                      patchItem(item.id, { newTab: event.target.checked })
                    }
                  />{" "}
                  Open in new tab
                </label>
              </div>
              <div className="flex flex-wrap gap-2 py-2">
                <Button
                  id={`menu-up-${item.id}`}
                  disabled={index === 0}
                  onClick={() => move(item, -1)}
                >
                  Move up
                </Button>
                <Button
                  id={`menu-down-${item.id}`}
                  disabled={index === siblings.length - 1}
                  onClick={() => move(item, 1)}
                >
                  Move down
                </Button>
                <Button
                  onClick={() => {
                    focusTarget.current = "menu-add-item";
                    const removed = new Set([
                      item.id,
                      ...descendants.map(({ id }) => id),
                    ]);
                    setDraft({
                      ...draft,
                      items: draft.items.filter(({ id }) => !removed.has(id)),
                    });
                    setMessage("Item removed from the draft.");
                  }}
                >
                  Remove item
                </Button>
              </div>
              {renderItems(item.id)}
            </li>
          );
        })}
      </ul>
    );
  }

  if (loading) {
    return <p role="status">Loading menus…</p>;
  }

  return (
    <AdminPageLayout title="Menus">
      {error && <p role="alert">{error}</p>}
      {destinationError && (
        <p role="alert">Unable to load menu destinations.</p>
      )}
      <p role="status">{message}</p>
      <fieldset disabled={busy} className="space-y-4">
        <Select
          label="Menu"
          value={selected}
          options={[
            { value: "", label: "New menu" },
            ...menus.map(({ id, name }) => ({ value: id, label: name })),
          ]}
          onChangeAction={(id) => {
            if (!dirty || window.confirm("Discard unsaved menu changes?")) {
              selectMenu(id);
            }
          }}
        />
        <Input
          aria-label="Menu name"
          placeholder="Menu name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        />
        <fieldset className="flex flex-wrap gap-3">
          <legend>Locations</legend>
          {NavigationLocationSchema.options.map((location) => (
            <label key={location}>
              <input
                type="checkbox"
                checked={draft.locations.includes(location)}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    locations: event.target.checked
                      ? [...draft.locations, location]
                      : draft.locations.filter((entry) => entry !== location),
                  })
                }
              />{" "}
              {location}
            </label>
          ))}
        </fieldset>
        <Input
          aria-label="Search destinations"
          placeholder="Search Pages, Posts, Categories and Tags"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {renderItems(null) ?? <p>This menu has no items.</p>}
        <div className="sticky bottom-0 flex flex-wrap items-center gap-2 bg-base-100 py-3">
          <Button
            id="menu-add-item"
            disabled={draft.items.length >= maxMenuItems}
            onClick={() =>
              setDraft({
                ...draft,
                items: [
                  ...draft.items,
                  {
                    id: crypto.randomUUID(),
                    parentId: null,
                    kind: "content",
                    label: "",
                    value: "",
                    newTab: false,
                  },
                ],
              })
            }
          >
            Add item
          </Button>
          <Button
            disabled={!dirty || !draft.name.trim()}
            onClick={() => void persist()}
          >
            Save menu
          </Button>
          <Button disabled={!dirty} onClick={() => selectMenu(selected)}>
            Cancel changes
          </Button>
          {saved && (
            <Button onClick={() => void persist(true)}>Delete menu</Button>
          )}
          {dirty && <span>Unsaved changes</span>}
        </div>
      </fieldset>
    </AdminPageLayout>
  );
}
