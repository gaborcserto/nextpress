"use client";

import { AppearanceCatalogSchema } from "@nextpress/shared";
import {
  maxMenuDepth,
  maxMenuItems,
  NavigationLocationSchema,
  NavigationMenuListSchema,
} from "@nextpress/shared/api-contracts";
import { isPagePath, pageLayouts } from "@nextpress/shared/content";
import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  FaBeer,
  FaChevronDown,
  FaEye,
  FaEyeSlash,
  FaIndent,
  FaGripVertical,
  FaLink,
  FaOutdent,
  FaPlus,
  FaSearch,
} from "react-icons/fa";
import {
  FaArrowDown,
  FaArrowUp,
  FaFloppyDisk,
  FaTrash,
  FaXmark,
} from "react-icons/fa6";
import { z } from "zod";

import { PublicationStatusBadge } from "@/features/content/publication/PublicationStatusBadge";
import { isSystemPage } from "@/features/pages/system-page";
import { apiFetch } from "@/lib/api";
import { useAdminLocale } from "@/lib/i18n/admin-locale";
import { EmptyState } from "@/ui/components/EmptyState";
import tabStyles from "@/ui/components/TabStrip.module.css";
import { TruncatedText } from "@/ui/components/TruncatedText/TruncatedText";
import {
  AdminAsyncButton,
  AdminButton,
  Input,
  Section,
  Select,
  Toggle,
  Tooltip,
} from "@/ui/primitives";
import { AdminIconButton } from "@/ui/primitives/Buttons";
import { AdminPageLayout } from "@/ui/shell/AdminPageLayout";
import { showToast } from "@/ui/utils";

import {
  ancestors,
  flattenMenuItems,
  menuDropPlaceholderIndex,
  moveMenuItem,
  menuIndentSize,
  projectMenuItemDrop,
  projectMenuItemMove,
} from "./menu-items";
import { MenuPageOption } from "./MenuPageOption";
import styles from "./MenusScreen.module.css";

import type {
  NavigationItemInput,
  NavigationMenuInput,
} from "@nextpress/shared/api-contracts";

type Menu = z.infer<typeof NavigationMenuListSchema>[number];
type Location = z.infer<typeof NavigationLocationSchema>;
type DropTarget = NonNullable<ReturnType<typeof projectMenuItemDrop>>;
type ActiveDrag = {
  id: string;
  x: number;
  y: number;
  startX: number;
  width: number;
  height: number;
  depth: number;
};

const endpoint = "/api/admin/navigation";
const emptyMenu: NavigationMenuInput = { name: "", locations: [], items: [] };
const errorBody = z.object({ error: z.string() });
const contentResults = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      slug: z.string(),
      type: z.enum(["PAGE", "POST"]),
      layout: z.string().optional(),
      parentId: z.string().nullable().optional(),
      status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
      publishedAt: z.string().nullable().optional(),
    }),
  ),
});
const taxonomyResults = z.object({
  items: z.array(z.object({ id: z.string(), name: z.string() })),
});

async function readMenus() {
  const response = await apiFetch(endpoint, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load menus.");
  }

  return NavigationMenuListSchema.parse(await response.json());
}

export function MenusScreen() {
  const hu = useAdminLocale() === "hu";
  const kinds = hu
    ? {
        content: "Oldal",
        taxonomy: "Kategória vagy címke",
        external: "Külső hivatkozás",
        internal: "Belső hivatkozás",
        group: "Csoport",
      }
    : {
        content: "Page",
        taxonomy: "Category or tag",
        external: "External link",
        internal: "Internal link",
        group: "Group",
      };
  const locations = hu
    ? { header: "Fejléc", footer: "Lábléc", sidebar: "Oldalsáv" }
    : { header: "Header", footer: "Footer", sidebar: "Sidebar" };

  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const dropTargetRef = useRef<DropTarget | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<
    {
      title: string;
      kind: "content" | "taxonomy";
      entries: {
        id: string;
        title: string;
        href?: string;
        status?: "DRAFT" | "PUBLISHED";
        publishedAt?: string | null;
        systemPage?: boolean;
      }[];
    }[]
  >([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [taxonomies, setTaxonomies] = useState<{ id: string; title: string }[]>(
    [],
  );
  const focusTarget = useRef<string | null>(null);
  const previousPositions = useRef<Map<string, DOMRect> | null>(null);
  const [selected, setSelected] = useState("");
  const [activeLocation, setActiveLocation] = useState<Location>("header");
  const [sidebarSupported, setSidebarSupported] = useState(false);
  const [draft, setDraft] = useState(emptyMenu);
  const [destinations, setDestinations] = useState<
    {
      id: string;
      title: string;
      href: string;
      status?: "DRAFT" | "PUBLISHED";
      publishedAt?: string | null;
      systemPage?: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<"save" | "delete" | null>(null);
  const busy = pending !== null;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [destinationError, setDestinationError] = useState(false);
  const saved = menus.find(({ id }) => selected === id);
  const baseline = saved
    ? { name: saved.name, locations: saved.locations, items: saved.items }
    : emptyMenu;
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      apiFetch("/api/admin/settings/appearance", { signal: controller.signal }),
      apiFetch("/api/admin/settings/appearance/catalog", {
        signal: controller.signal,
      }),
    ])
      .then(async ([appearanceResponse, catalogResponse]) => {
        if (!appearanceResponse.ok || !catalogResponse.ok) {
          throw new Error("Unable to load navigation capabilities");
        }

        const appearance = z
          .object({ websiteTemplate: z.string(), stylePreset: z.string() })
          .parse(await appearanceResponse.json());
        const catalog = AppearanceCatalogSchema.parse(
          await catalogResponse.json(),
        );
        const template = catalog.find(
          ({ id }) => id === appearance.websiteTemplate,
        );
        const preset = template?.presets.find(
          ({ id }) => id === appearance.stylePreset,
        );

        if (!controller.signal.aborted) {
          setSidebarSupported(preset?.navigation.sidebar ?? false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setSidebarSupported(false);
        }
      });

    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;

    void readMenus()
      .then((data) => {
        if (active) {
          setMenus(data);
          const assigned = data.find((menu) =>
            menu.locations.includes("header"),
          );

          if (assigned) {
            setSelected(assigned.id);
            setDraft({
              name: assigned.name,
              locations: assigned.locations,
              items: assigned.items,
            });
          }
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
          const pageEntries = contentResults.parse(pages).items;
          const postEntries = contentResults.parse(posts).items;
          const pagePaths = new Map<string, string>();
          const pageById = new Map(pageEntries.map((page) => [page.id, page]));

          function resolvePagePath(id: string, depth = 0): string | null {
            if (pagePaths.has(id)) {
              return pagePaths.get(id) ?? null;
            }

            const page = pageById.get(id);

            if (!page || depth >= 8) {
              return null;
            }

            if (page.layout === pageLayouts.home && !page.parentId) {
              pagePaths.set(id, "/");

              return "/";
            }

            if (page.layout === pageLayouts.posts) {
              pagePaths.set(id, "/posts");

              return "/posts";
            }

            const parentPath = page.parentId
              ? resolvePagePath(page.parentId, depth + 1)
              : "";
            const segments = [
              ...(parentPath && parentPath !== "/"
                ? parentPath.split("/").filter(Boolean)
                : []),
              page.slug,
            ];
            const path = isPagePath(segments) ? `/${segments.join("/")}` : null;

            if (path) {
              pagePaths.set(id, path);
            }

            return path;
          }

          const pageDestinations = pageEntries.map((page) => ({
            id: page.id,
            title: page.title,
            href: resolvePagePath(page.id) ?? `/pages/${page.slug}`,
            status: page.status,
            publishedAt: page.publishedAt,
            systemPage: isSystemPage(page.layout, page.slug),
          }));
          const postDestinations = postEntries.map((post) => ({
            id: post.id,
            title: post.title,
            href: `/posts/${post.slug}`,
            status: post.status,
            publishedAt: post.publishedAt,
          }));
          const categoryEntries = taxonomyResults
            .parse(categories)
            .items.map(({ id, name }) => ({ id, title: name }));
          const tagEntries = taxonomyResults
            .parse(tags)
            .items.map(({ id, name }) => ({ id, title: name }));

          setGroups([
            {
              title: hu ? "Oldalak" : "Pages",
              kind: "content",
              entries: pageDestinations,
            },
            {
              title: hu ? "Bejegyzések" : "Posts",
              kind: "content",
              entries: postDestinations,
            },
            {
              title: hu ? "Kategóriák" : "Categories",
              kind: "taxonomy",
              entries: categoryEntries,
            },
            {
              title: hu ? "Címkék" : "Tags",
              kind: "taxonomy",
              entries: tagEntries,
            },
          ]);
          setDestinations([...pageDestinations, ...postDestinations]);
          setTaxonomies([...categoryEntries, ...tagEntries]);
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
  }, [hu, search]);

  useLayoutEffect(() => {
    const previous = previousPositions.current;
    previousPositions.current = null;

    if (
      previous &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      for (const row of Array.from(
        document.querySelectorAll<HTMLElement>("[data-menu-item-id]"),
      )) {
        const id = row.dataset.menuItemId;
        const before = id ? previous.get(id) : undefined;

        if (!before) {
          continue;
        }

        const after = row.getBoundingClientRect();
        const x = before.left - after.left;
        const y = before.top - after.top;

        if (x || y) {
          row.animate(
            [
              { transform: `translate(${x}px, ${y}px)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: 180, easing: "ease-out" },
          );
        }
      }
    }

    if (focusTarget.current) {
      document.getElementById(focusTarget.current)?.focus();
      focusTarget.current = null;
    }
  }, [draft.items, dropTarget]);

  function selectMenu(id: string, available = menus) {
    const menu = available.find((entry) => entry.id === id);
    setSelected(menu?.id ?? "");
    setDraft(
      menu
        ? { name: menu.name, locations: menu.locations, items: menu.items }
        : emptyMenu,
    );
  }

  function selectLocation(location: Location) {
    if (location === activeLocation) {
      return;
    }

    if (dirty && !window.confirm("Discard unsaved menu changes?")) {
      return;
    }

    setActiveLocation(location);
    const assigned = menus.find((menu) => menu.locations.includes(location));
    selectMenu(assigned?.id ?? "");
  }

  function addItems(
    kind: NavigationItemInput["kind"],
    entries: Pick<NavigationItemInput, "label" | "value">[],
  ) {
    const added = entries
      .slice(0, maxMenuItems - draft.items.length)
      .map(({ label, value }) => ({
        id: crypto.randomUUID(),
        parentId: null,
        kind,
        label: kind === "content" ? "" : label,
        value,
        newTab: false,
        visible: true,
      }));

    setDraft({ ...draft, items: [...draft.items, ...added] });
    setChecked((current) =>
      current.filter((id) => !added.some(({ value }) => value === id)),
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

  function applyMenuItems(items: NavigationItemInput[] | null) {
    if (!items) {
      setError(
        hu
          ? "Érvénytelen menühierarchia."
          : "This move would create an invalid menu hierarchy.",
      );

      return;
    }

    setError("");
    setDraft({ ...draft, items });
  }

  function captureMenuPositions() {
    previousPositions.current = new Map(
      Array.from(
        document.querySelectorAll<HTMLElement>("[data-menu-item-id]"),
      ).map((row) => [
        row.dataset.menuItemId ?? "",
        row.getBoundingClientRect(),
      ]),
    );
  }

  function setDropProjection(target: DropTarget | null) {
    const current = dropTargetRef.current;

    if (
      current?.parentId === target?.parentId &&
      current?.beforeId === target?.beforeId &&
      current?.depth === target?.depth
    ) {
      return;
    }

    captureMenuPositions();
    dropTargetRef.current = target;
    setDropTarget(target);
  }

  function placeItem(id: string, target: DropTarget) {
    const current = draft.items.find((item) => item.id === id);
    const siblings = draft.items.filter(
      (item) => item.parentId === current?.parentId,
    );
    const currentIndex = siblings.findIndex((item) => item.id === id);

    if (
      current?.parentId === target.parentId &&
      siblings[currentIndex + 1]?.id === target.beforeId
    ) {
      return;
    }

    const items = moveMenuItem(
      draft.items,
      id,
      target.parentId,
      target.beforeId,
    );

    if (!items) {
      setError(
        hu
          ? "Érvénytelen menühierarchia."
          : "This move would create an invalid menu hierarchy.",
      );

      return;
    }

    const moved = items.find((item) => item.id === id);
    captureMenuPositions();
    setError("");
    setDraft({ ...draft, items });
    setMessage(
      hu
        ? `${moved?.label || "Menüpont"} áthelyezve.`
        : `${moved?.label || "Menu item"} moved.`,
    );
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLButtonElement>,
    item: NavigationItemInput,
  ) {
    if (busy || event.button !== 0) {
      return;
    }

    const row = event.currentTarget.closest<HTMLElement>("[data-menu-item-id]");
    const bounds = row?.getBoundingClientRect();
    const depth = Number(row?.dataset.menuItemDepth ?? 0);
    const siblings = draft.items.filter(
      (entry) => entry.parentId === item.parentId,
    );
    const siblingIndex = siblings.findIndex((entry) => entry.id === item.id);
    const target = projectMenuItemMove(
      draft.items,
      item.id,
      item.parentId,
      siblings[siblingIndex + 1]?.id,
    );

    if (!target) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDropProjection(target);
    const width = Math.min(bounds?.width ?? 280, window.innerWidth - 16);

    setActiveDrag({
      id: item.id,
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      width,
      height: bounds?.height ?? 44,
      depth,
    });
    setMessage(hu ? "Menüpont mozgatása." : "Moving menu item.");
  }

  function updateDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (!activeDrag) {
      return;
    }

    setActiveDrag({ ...activeDrag, x: event.clientX, y: event.clientY });
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-menu-item-id]"),
    ).filter((row) => row.dataset.menuItemId !== activeDrag.id);
    const hovered = rows.find((row) => {
      const bounds = row.getBoundingClientRect();

      return event.clientY >= bounds.top && event.clientY <= bounds.bottom;
    });
    const slotIndex = rows.findIndex((row) => {
      const bounds = row.getBoundingClientRect();

      return event.clientY < bounds.top + bounds.height / 2;
    });
    const requestedDepth = Math.max(
      0,
      activeDrag.depth +
        Math.round((event.clientX - activeDrag.startX) / menuIndentSize),
    );
    const hoveredDepth = Number(hovered?.dataset.menuItemDepth ?? -1);
    const insideTargetId =
      hovered && requestedDepth > hoveredDepth
        ? hovered.dataset.menuItemId
        : undefined;

    const projection = projectMenuItemDrop(
      draft.items,
      activeDrag.id,
      slotIndex < 0 ? rows.length : slotIndex,
      requestedDepth,
      insideTargetId,
    );

    if (projection) {
      setDropProjection(projection);
    }
  }

  function finishDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();

    if (activeDrag && dropTargetRef.current) {
      placeItem(activeDrag.id, dropTargetRef.current);
    }

    setActiveDrag(null);
    setDropProjection(null);
  }

  function cancelDrag() {
    setActiveDrag(null);
    setDropProjection(null);
  }

  async function persist(remove = false) {
    if (
      remove &&
      (!saved || !window.confirm(`Delete the menu “${saved.name}”?`))
    ) {
      return;
    }

    setPending(remove ? "delete" : "save");
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
      showToast(remove ? "Menu deleted." : "Menu saved.");
    } catch (failure) {
      showToast(
        failure instanceof Error
          ? failure.message
          : "The menu operation failed.",
        "error",
      );
    } finally {
      setPending(null);
    }
  }

  function renderItems() {
    const orderedItems = flattenMenuItems(draft.items);

    if (!orderedItems.length) {
      return null;
    }

    const placeholderIndex =
      activeDrag && dropTarget
        ? menuDropPlaceholderIndex(draft.items, dropTarget)
        : -1;
    const dropPlaceholder =
      activeDrag && dropTarget ? (
        <li
          key="menu-drop-placeholder"
          aria-hidden="true"
          className={styles.dropPlaceholder}
          style={{
            height: activeDrag.height,
            marginInlineStart: dropTarget.depth * menuIndentSize,
            width: `calc(100% - ${dropTarget.depth * menuIndentSize}px)`,
          }}
        />
      ) : null;

    return (
      <ul className="space-y-3">
        {orderedItems.map(({ item, depth }, rowIndex) => {
          const siblings = draft.items.filter(
            (entry) => entry.parentId === item.parentId,
          );
          const index = siblings.findIndex((entry) => entry.id === item.id);
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
          const defaultLabel =
            item.kind === "content"
              ? destinations.find(({ id }) => id === item.value)?.title
              : undefined;
          const hasDestination =
            item.kind === "content" || item.kind === "taxonomy"
              ? choices.some(({ id }) => id === item.value)
              : true;
          const destination =
            item.kind === "content"
              ? destinations.find(({ id }) => id === item.value)
              : undefined;
          const title =
            item.label ||
            (item.kind === "content" || item.kind === "taxonomy"
              ? (item.kind === "taxonomy" ? taxonomies : destinations).find(
                  ({ id }) => id === item.value,
                )?.title
              : "") ||
            item.value ||
            (hu ? "Névtelen elem" : "Untitled item");
          const titleStatus =
            destination?.status === "PUBLISHED"
              ? "published"
              : destination?.status === "DRAFT"
                ? "draft"
                : "default";

          return (
            <Fragment key={item.id}>
              {placeholderIndex === rowIndex && dropPlaceholder}
              <li
                data-menu-item-id={item.id}
                data-menu-item-depth={depth}
                style={{
                  marginInlineStart: `max(0px, ${depth} * var(--menu-indent, ${menuIndentSize}px))`,
                }}
                data-status={titleStatus}
                className={`relative min-w-0 rounded-(--radius-control) border p-0 transition-[transform,border-color] duration-150 motion-reduce:transition-none ${styles.menuItemRow} ${!item.visible ? styles.hiddenMenuItem : ""} ${activeDrag?.id === item.id ? "opacity-40" : ""}`}
              >
                <details className={`group ${styles.accordion}`}>
                  <summary
                    className={`cursor-pointer list-none focus-visible:outline-2 focus-visible:outline-(--focus-color) [&::-webkit-details-marker]:hidden ${styles.accordionHeader}`}
                  >
                    <button
                      type="button"
                      aria-label={
                        hu
                          ? "Menüpont áthúzása az átrendezéshez"
                          : "Drag menu item to reorder"
                      }
                      aria-describedby="menu-drag-instructions"
                      className="inline-flex size-9 shrink-0 cursor-grab touch-none items-center justify-center border-0 bg-transparent p-0 text-(--text-muted) shadow-none hover:bg-transparent active:bg-transparent active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-(--focus-color)"
                      onPointerDown={(event) => beginDrag(event, item)}
                      onPointerMove={updateDrag}
                      onPointerUp={finishDrag}
                      onPointerCancel={cancelDrag}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && activeDrag) {
                          cancelDrag();
                        }
                      }}
                    >
                      <FaGripVertical aria-hidden="true" className="size-4" />
                    </button>
                    <span
                      className={`${styles.menuItemName} min-w-0 text-base leading-6 font-semibold text-(--text-primary)`}
                      role="heading"
                      aria-level={3}
                    >
                      <TruncatedText value={title} />
                    </span>
                    <span
                      className={`${styles.menuItemKind} shrink-0 text-sm text-(--text-muted)`}
                    >
                      {item.kind === "internal" || item.kind === "external"
                        ? hu
                          ? "Egyéni hivatkozás"
                          : "Custom link"
                        : kinds[item.kind]}
                    </span>
                    <Tooltip
                      id={`menu-visibility-${item.id}`}
                      content={
                        item.visible
                          ? hu
                            ? "Elrejtés"
                            : "Hide menu item"
                          : hu
                            ? "Megjelenítés"
                            : "Show menu item"
                      }
                    >
                      <button
                        type="button"
                        aria-label={
                          item.visible
                            ? hu
                              ? "Elrejtés a nyilvános menüből"
                              : "Hide menu item"
                            : hu
                              ? "Megjelenítés a nyilvános menüben"
                              : "Show menu item"
                        }
                        title={
                          item.visible
                            ? hu
                              ? "Elrejtés a nyilvános menüből"
                              : "Hide menu item"
                            : hu
                              ? "Megjelenítés a nyilvános menüben"
                              : "Show menu item"
                        }
                        className="menu-visibility inline-flex size-9 shrink-0 items-center justify-center rounded-(--radius-control) border-0 bg-transparent text-(--text-muted) focus-visible:outline-2 focus-visible:outline-(--focus-color)"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.preventDefault();
                          patchItem(item.id, { visible: !item.visible });
                        }}
                      >
                        {item.visible ? (
                          <FaEye aria-hidden="true" />
                        ) : (
                          <FaEyeSlash aria-hidden="true" />
                        )}
                      </button>
                    </Tooltip>
                    <FaChevronDown
                      className="menu-expansion size-4 shrink-0 text-(--text-muted) transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>
                  {item.kind === "content" && !hasDestination && (
                    <p className="px-3 pt-2 text-sm text-(--text-warning)">
                      {hu
                        ? "A hivatkozott oldal nem el\u00e9rhet\u0151."
                        : "This page is unavailable and will not appear publicly."}
                    </p>
                  )}
                  {destination?.status === "PUBLISHED" &&
                    (!destination.publishedAt ||
                      Date.parse(destination.publishedAt) > Date.now()) && (
                      <p className="px-3 pt-2 text-sm text-(--text-warning)">
                        {hu
                          ? "Az oldal m\u00e9g nem el\u00e9rhet\u0151 nyilv\u00e1nosan."
                          : "This page is not yet publicly available."}
                      </p>
                    )}
                  {!item.visible && (
                    <p className="px-3 pt-2 text-sm text-(--text-muted)">
                      {hu ? "K\u00e9zzel elrejtve." : "Manually hidden."}
                    </p>
                  )}
                  <div className={styles.accordionContent}>
                    {(destination?.systemPage || destination?.status) && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {destination.systemPage && (
                          <span className="admin-badge admin-badge-info">
                            {hu ? "Rendszeroldal" : "System page"}
                          </span>
                        )}
                        {destination.status && (
                          <PublicationStatusBadge
                            status={
                              destination.status === "DRAFT"
                                ? "DRAFT"
                                : !destination.publishedAt
                                  ? "MISSING_DATE"
                                  : Date.parse(destination.publishedAt) >
                                      Date.now()
                                    ? "SCHEDULED"
                                    : "PUBLISHED"
                            }
                          />
                        )}
                      </div>
                    )}
                    <div className="grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
                      <Input
                        label={hu ? "Felirat" : "Label"}
                        aria-label={hu ? "Menüpont felirata" : "Item label"}
                        placeholder={hu ? "Menüpont felirata" : "Item label"}
                        value={item.label || defaultLabel || ""}
                        fullWidth
                        onChange={(event) =>
                          patchItem(item.id, { label: event.target.value })
                        }
                      />
                      {(item.kind === "content" ||
                        item.kind === "taxonomy") && (
                        <Select
                          label={
                            item.kind === "content"
                              ? hu
                                ? "Oldal"
                                : "Page"
                              : kinds[item.kind]
                          }
                          fullWidth
                          placeholder={hu ? "Válasszon célt" : "Select content"}
                          value={item.value}
                          options={[
                            ...(!choices.some(({ id }) => id === item.value) &&
                            item.value
                              ? [
                                  {
                                    value: item.value,
                                    label: hu
                                      ? "Meglévő hivatkozás"
                                      : "Existing reference",
                                  },
                                ]
                              : []),
                            ...choices.map(({ id, title }) => ({
                              value: id,
                              label: title,
                            })),
                          ]}
                          onChangeAction={(value) => {
                            patchItem(item.id, { value });
                          }}
                        />
                      )}
                      {item.kind === "content" && (
                        <div className="flex min-w-0 items-baseline gap-2 text-sm sm:col-span-2">
                          <span className="shrink-0 font-medium text-(--text-secondary)">
                            {hu ? "Feloldott URL" : "Resolved URL"}
                          </span>
                          <span className="min-w-0 break-all text-(--text-muted)">
                            {destinations.find(({ id }) => id === item.value)
                              ?.href ?? item.value}
                          </span>
                        </div>
                      )}
                      {(item.kind === "internal" ||
                        item.kind === "external") && (
                        <Input
                          label={hu ? "Hivatkozás címe" : "URL"}
                          aria-label={hu ? "Hivatkozás címe" : "Link URL"}
                          value={item.value}
                          fullWidth
                          className="sm:col-start-2"
                          onChange={(event) => {
                            const value = event.target.value;

                            patchItem(item.id, {
                              value,
                              kind: value.startsWith("/")
                                ? "internal"
                                : "external",
                            });
                          }}
                        />
                      )}
                      <div
                        className={`sm:col-span-2 ${
                          item.kind === "group"
                            ? "grid min-w-0 grid-cols-1 gap-3"
                            : `grid min-w-0 grid-cols-1 gap-3 ${styles.parentOptionsWithToggle}`
                        }`}
                      >
                        <Select
                          label={hu ? "Szülő menüpont" : "Parent item"}
                          id={`menu-parent-${item.id}`}
                          fullWidth
                          value={item.parentId ?? ""}
                          options={[
                            {
                              value: "",
                              label: hu ? "Legfelső szint" : "Top level",
                            },
                            ...parents
                              .filter(
                                (parent) =>
                                  ancestors(parent, draft.items).length +
                                    subtreeDepth <
                                  maxMenuDepth,
                              )
                              .map((parent) => ({
                                value: parent.id,
                                label:
                                  parent.label ||
                                  parent.value ||
                                  (hu ? "Névtelen elem" : "Untitled item"),
                              })),
                          ]}
                          onChangeAction={(value) => {
                            focusTarget.current = `menu-parent-${item.id}`;
                            patchItem(item.id, { parentId: value || null });
                            setMessage(
                              hu
                                ? "A menüpont szintje módosult."
                                : "Item level changed.",
                            );
                          }}
                        />
                        {item.kind !== "group" && (
                          <Toggle
                            checked={item.newTab}
                            color="primary"
                            onChangeAction={(newTab) =>
                              patchItem(item.id, { newTab })
                            }
                            size="sm"
                            inlineLabel={
                              hu ? "Megnyitás új lapon" : "Open in new tab"
                            }
                          />
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-(--surface-border) pt-3">
                      <AdminIconButton
                        id={`menu-up-${item.id}`}
                        type="button"
                        icon={FaArrowUp}
                        iconSize={14}
                        size="md"
                        variant="ghost"
                        aria-label={hu ? "Mozgatás felfelé" : "Move up"}
                        title={hu ? "Mozgatás felfelé" : "Move up"}
                        disabled={index === 0}
                        onClick={() => move(item, -1)}
                      />
                      <AdminIconButton
                        id={`menu-down-${item.id}`}
                        type="button"
                        icon={FaArrowDown}
                        iconSize={14}
                        size="md"
                        variant="ghost"
                        aria-label={hu ? "Mozgatás lefelé" : "Move down"}
                        title={hu ? "Mozgatás lefelé" : "Move down"}
                        disabled={index === siblings.length - 1}
                        onClick={() => move(item, 1)}
                      />
                      {index > 0 && (
                        <AdminIconButton
                          type="button"
                          icon={FaIndent}
                          iconSize={14}
                          variant="ghost"
                          size="md"
                          aria-label={hu ? "Behúzás" : "Indent"}
                          title={hu ? "Behúzás" : "Indent"}
                          onClick={() =>
                            applyMenuItems(
                              moveMenuItem(
                                draft.items,
                                item.id,
                                siblings[index - 1].id,
                              ),
                            )
                          }
                        />
                      )}
                      {item.parentId && (
                        <AdminIconButton
                          type="button"
                          icon={FaOutdent}
                          iconSize={14}
                          variant="ghost"
                          size="md"
                          aria-label={hu ? "Kihúzás" : "Outdent"}
                          title={hu ? "Kihúzás" : "Outdent"}
                          onClick={() =>
                            applyMenuItems(
                              moveMenuItem(
                                draft.items,
                                item.id,
                                ancestors(item, draft.items)[1] ?? null,
                              ),
                            )
                          }
                        />
                      )}
                      <AdminIconButton
                        type="button"
                        icon={FaTrash}
                        iconSize={14}
                        size="md"
                        color="error"
                        variant="ghost"
                        aria-label={
                          hu ? "Menüpont eltávolítása" : "Remove item"
                        }
                        title={hu ? "Menüpont eltávolítása" : "Remove item"}
                        onClick={() => {
                          focusTarget.current = "menu-add-item";
                          const removed = new Set([
                            item.id,
                            ...descendants.map(({ id }) => id),
                          ]);
                          setDraft({
                            ...draft,
                            items: draft.items.filter(
                              ({ id }) => !removed.has(id),
                            ),
                          });
                          setMessage("Item removed from the draft.");
                        }}
                      />
                    </div>
                  </div>
                </details>
              </li>
            </Fragment>
          );
        })}
        {placeholderIndex === orderedItems.length && dropPlaceholder}
      </ul>
    );
  }

  if (loading) {
    return <p role="status">Loading menus…</p>;
  }

  return (
    <AdminPageLayout
      title={hu ? "Menük" : "Menus"}
      description={
        hu
          ? "Kezelje webhelye navigációját."
          : "Manage your website navigation."
      }
      actions={
        <div className="admin-editor-buttons">
          {dirty && (
            <span className="admin-action-status" role="status">
              {hu ? "Nem mentett módosítások" : "Unsaved changes"}
            </span>
          )}
          <AdminButton
            variant="ghost"
            disabled={busy || !dirty}
            onClick={() => selectMenu(selected)}
          >
            <FaXmark aria-hidden="true" />
            {hu ? "Mégse" : "Cancel"}
          </AdminButton>
          <AdminAsyncButton
            color="primary"
            icon={FaFloppyDisk}
            disabled={busy || !dirty}
            loading={pending === "save"}
            onClick={() => void persist()}
          >
            {hu ? "Mentés" : "Save"}
          </AdminAsyncButton>
        </div>
      }
    >
      {error && <p role="alert">{error}</p>}
      {destinationError && (
        <p role="alert">Unable to load menu destinations.</p>
      )}
      {message && (
        <span className="sr-only" role="status">
          {message}
        </span>
      )}
      <fieldset disabled={busy} className="admin-tab-stack">
        <nav
          className={tabStyles.tabs}
          role="tablist"
          aria-label={hu ? "Menühelyek" : "Menu locations"}
        >
          {NavigationLocationSchema.options
            .filter((location) => location !== "sidebar" || sidebarSupported)
            .map((location, index, visibleLocations) => (
              <button
                key={location}
                id={`menu-location-${location}`}
                type="button"
                role="tab"
                aria-selected={activeLocation === location}
                tabIndex={activeLocation === location ? 0 : -1}
                onClick={() => selectLocation(location)}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                    return;
                  }

                  event.preventDefault();
                  const step = event.key === "ArrowRight" ? 1 : -1;
                  const next =
                    visibleLocations[
                      (index + step + visibleLocations.length) %
                        visibleLocations.length
                    ];
                  selectLocation(next);
                  document.getElementById(`menu-location-${next}`)?.focus();
                }}
              >
                {locations[location]}
              </button>
            ))}
        </nav>
        <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <Section title={hu ? "Menüpontok hozzáadása" : "Add menu items"}>
            <div className="grid gap-3">
              <Input
                aria-label={hu ? "Oldalak keresése" : "Search pages"}
                placeholder={hu ? "Oldalak keresése" : "Search pages"}
                type="search"
                size="sm"
                value={search}
                fullWidth
                leftIcon={<FaSearch size={14} />}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setChecked([]);
                }}
              />
              {groups.slice(0, 1).map(({ kind, entries }) => (
                <div key={kind}>
                  <div className="grid max-h-48 min-w-0 gap-1 overflow-auto rounded-(--radius-control) border border-(--surface-border) p-2">
                    {entries.map(({ id, title, status, systemPage }) => (
                      <MenuPageOption
                        key={id}
                        id={id}
                        title={title}
                        checked={checked.includes(id)}
                        status={status}
                        systemPage={systemPage}
                        onCheckedChange={(isChecked) =>
                          setChecked(
                            isChecked
                              ? [...checked, id]
                              : checked.filter((entry) => entry !== id),
                          )
                        }
                      />
                    ))}
                  </div>
                  <AdminButton
                    type="button"
                    variant="solid"
                    color="primary"
                    size="md"
                    fullWidth
                    className="mt-3"
                    disabled={
                      !entries.some(({ id }) => checked.includes(id)) ||
                      draft.items.length >= maxMenuItems
                    }
                    onClick={() =>
                      addItems(
                        kind,
                        entries
                          .filter(({ id }) => checked.includes(id))
                          .map(({ id, title }) => ({
                            label: title,
                            value: id,
                          })),
                      )
                    }
                  >
                    <FaPlus aria-hidden="true" />
                    {hu ? "Kijelöltek hozzáadása" : "Add selected"}
                  </AdminButton>
                </div>
              ))}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <AdminButton
                  id="menu-add-item"
                  type="button"
                  variant="outline"
                  color="primary"
                  size="md"
                  fullWidth
                  disabled={draft.items.length >= maxMenuItems}
                  onClick={() =>
                    addItems("external", [{ label: "", value: "" }])
                  }
                >
                  <FaLink aria-hidden="true" />
                  {hu ? "Egyéni hivatkozás" : "Custom link"}
                </AdminButton>
                <AdminButton
                  type="button"
                  variant="outline"
                  color="primary"
                  size="md"
                  fullWidth
                  disabled={draft.items.length >= maxMenuItems}
                  onClick={() =>
                    addItems("group", [{ label: kinds.group, value: "" }])
                  }
                >
                  <FaPlus aria-hidden="true" />
                  {kinds.group}
                </AdminButton>
              </div>
            </div>
          </Section>
          <Section title={hu ? "Menüszerkezet" : "Menu structure"}>
            {draft.items.length > 0 ? (
              <>
                <p className="mb-3 text-sm text-(--text-muted)">
                  {hu
                    ? `${draft.items.length} menüpont · Húzza a pontokat az átrendezéshez.`
                    : `${draft.items.length} items · Drag items to reorder.`}
                </p>
                <span id="menu-drag-instructions" className="sr-only">
                  {hu
                    ? "Húzza vízszintesen a menüpontot a beágyazáshoz vagy a legfelső szintre emeléshez."
                    : "Drag horizontally to nest an item or move it to the top level."}
                </span>
                {renderItems()}
              </>
            ) : (
              <EmptyState
                icon={FaBeer}
                heading={hu ? "Még nincsenek menüpontok" : "No menu items yet"}
                description={
                  hu
                    ? "Adjon hozzá oldalakat, egyéni hivatkozásokat vagy csoportokat a navigáció felépítéséhez."
                    : "Add pages, custom links or groups to build your navigation."
                }
              />
            )}
          </Section>
        </div>
      </fieldset>
      {activeDrag && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-50 rounded-(--radius-control) border border-primary bg-(--surface-raised) px-4 py-3 text-sm shadow-lg"
          style={{
            left: Math.max(
              8,
              Math.min(
                activeDrag.x + 12,
                window.innerWidth - activeDrag.width - 8,
              ),
            ),
            top: activeDrag.y + 12,
            width: activeDrag.width,
          }}
        >
          {draft.items.find(({ id }) => id === activeDrag.id)?.label ||
            (hu ? "Menüpont" : "Menu item")}
        </div>
      )}
    </AdminPageLayout>
  );
}
