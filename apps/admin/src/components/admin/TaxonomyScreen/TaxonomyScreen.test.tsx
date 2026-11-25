import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import TaxonomyScreen from "./TaxonomyScreen";

const navigation = vi.hoisted(() => ({ query: "", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  usePathname: () => "/admin/taxonomy",
  useRouter: () => ({ push: navigation.push, replace: vi.fn() }),
}));

function renderTaxonomy() {
  const cache = new Map();

  return render(
    <SWRConfig value={{ provider: () => cache }}>
      <TaxonomyScreen />
    </SWRConfig>,
  );
}

function listResponse(
  items: { id: string; name: string; slug: string; usedCount: number }[],
) {
  return Response.json({
    items,
    page: 1,
    limit: 50,
    total: items.length,
    pages: items.length ? 1 : 0,
  });
}

afterEach(() => {
  navigation.query = "";
  navigation.push.mockClear();
  vi.unstubAllGlobals();
});

it("announces loading without showing an empty state", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  renderTaxonomy();
  expect(screen.getByRole("status")).toHaveTextContent(/Loading tags/);
  expect(screen.queryByText("No tags found.")).not.toBeInTheDocument();
});

it("renders records, slugs, and zero, single, and multiple post usage counts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      listResponse([
        { id: "many", name: "Many", slug: "many-tag", usedCount: 3 },
        { id: "one", name: "One", slug: "one-tag", usedCount: 1 },
        { id: "unused", name: "Unused", slug: "unused-tag", usedCount: 0 },
      ]),
    ),
  );
  renderTaxonomy();
  const deleteButton = await screen.findByRole("button", {
    name: "Delete tag Many",
  });
  expect(deleteButton).toHaveClass("btn-error", "btn-ghost");
  const rows = screen.getAllByRole("row").slice(1);
  expect(rows).toHaveLength(3);

  for (const [index, name, slug, count] of [
    [0, "Many", "many-tag", "3"],
    [1, "One", "one-tag", "1"],
    [2, "Unused", "unused-tag", "0"],
  ] as const) {
    expect(within(rows[index]).getByText(name)).toBeInTheDocument();
    expect(within(rows[index]).getByText(slug)).toBeInTheDocument();
    expect(within(rows[index]).getByText(count)).toBeInTheDocument();
  }

  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("shows empty taxonomy only after a successful empty response", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([])));
  renderTaxonomy();
  expect(await screen.findByText("No tags found.")).toBeInTheDocument();
});

it("edits a tag name and slug in place and refreshes the list", async () => {
  const fetch = vi
    .fn()
    .mockImplementation((input: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return Promise.resolve(Response.json({ ok: true, data: {} }));
      }

      return Promise.resolve(
        listResponse([
          { id: "tag-id", name: "News", slug: "news", usedCount: 2 },
        ]),
      );
    });
  vi.stubGlobal("fetch", fetch);
  renderTaxonomy();

  fireEvent.click(await screen.findByRole("button", { name: "Edit tag News" }));
  const dialog = screen.getByRole("dialog", { name: "Edit tag" });
  expect(dialog).toHaveClass("taxonomy-dialog");
  expect(dialog.firstElementChild).toHaveClass("admin-dialog-header");
  expect(screen.getByRole("heading", { name: "Edit tag" })).toHaveAttribute(
    "id",
    "edit-tag-title",
  );
  const closeButton = within(dialog).getByRole("button", {
    name: "Close dialog",
  });
  expect(closeButton.querySelector("svg")).toBeInTheDocument();
  expect(within(dialog).queryByLabelText("Record ID")).not.toBeInTheDocument();
  expect(dialog.querySelector("details")).not.toBeInTheDocument();

  fireEvent.click(closeButton);
  await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  fireEvent.click(screen.getByRole("button", { name: "Edit tag News" }));

  expect(screen.getByRole("textbox", { name: "Name" })).toHaveValue("News");
  expect(screen.getByRole("textbox", { name: "Slug" })).toHaveValue("news");
  expect(
    within(dialog).getByRole("button", { name: "Cancel" }).querySelector("svg"),
  ).toBeInTheDocument();
  expect(
    within(dialog)
      .getByRole("button", { name: "Save changes" })
      .querySelector("svg"),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
    target: { value: "Latest News" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Slug" }), {
    target: { value: "latest-news" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  await waitFor(() =>
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/tags/tag-id",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ name: "Latest News", slug: "latest-news" }),
      }),
    ),
  );
});

it("loads categories, applies search immediately, and sorts usage from the column header", async () => {
  navigation.query = "type=CATEGORY&page=2";
  const fetch = vi.fn().mockImplementation(() =>
    Response.json({
      items: [{ id: "news", name: "News", slug: "news", usedCount: 12 }],
      page: 2,
      limit: 50,
      total: 51,
      pages: 2,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  renderTaxonomy();

  expect(
    await screen.findByRole("table", { name: "Categories" }),
  ).toHaveTextContent("News");
  expect(screen.getByRole("columnheader", { name: /Name/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  expect(
    screen.queryByRole("button", { name: "Create tag" }),
  ).not.toBeInTheDocument();
  expect(fetch.mock.calls[0]?.[0]).toBe("/api/admin/tags?page=2&type=CATEGORY");
  expect(
    screen.getByRole("link", { name: "Categories", current: "page" }),
  ).toBeVisible();
  expect(screen.getByRole("link", { name: "Tags" })).toHaveAttribute(
    "href",
    "/admin/taxonomy?type=TAG",
  );

  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
    target: { value: "News" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit search" }));
  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/taxonomy?type=CATEGORY&q=News",
    { scroll: false },
  );

  fireEvent.click(screen.getByRole("button", { name: "Posts" }));

  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/taxonomy?type=CATEGORY&sort=usedCount&direction=asc",
    { scroll: false },
  );
});

it("toggles the active taxonomy column direction", async () => {
  navigation.query = "type=TAG&sort=slug&direction=asc";
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(listResponse([])));
  renderTaxonomy();

  const slugHeader = await screen.findByRole("columnheader", { name: /Slug/ });
  expect(slugHeader).toHaveAttribute("aria-sort", "ascending");
  fireEvent.click(within(slugHeader).getByRole("button", { name: /Slug/ }));

  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/taxonomy?type=TAG&sort=slug&direction=desc",
    { scroll: false },
  );
});

it("keeps the category form open and displays a duplicate rejection", async () => {
  navigation.query = "type=CATEGORY";
  const fetch = vi.fn((_input: string, init?: RequestInit) =>
    Promise.resolve(
      init?.method === "POST"
        ? Response.json(
            { error: "This taxonomy slug already exists" },
            { status: 409 },
          )
        : listResponse([]),
    ),
  );
  vi.stubGlobal("fetch", fetch);
  renderTaxonomy();

  fireEvent.click(screen.getByRole("button", { name: "Create category" }));
  const dialog = screen.getByRole("dialog", { name: "Create category" });
  expect(dialog).toHaveClass("taxonomy-dialog");
  expect(dialog.firstElementChild).toHaveClass("admin-dialog-header");
  expect(
    screen.getByRole("heading", { name: "Create category" }),
  ).toHaveAttribute("id", "create-tag-title");
  expect(
    within(dialog).getByRole("button", { name: "Close dialog" }),
  ).toBeVisible();
  expect(
    within(dialog).getByRole("button", { name: "Cancel" }).querySelector("svg"),
  ).toBeInTheDocument();
  expect(
    within(dialog)
      .getByRole("button", { name: "Create category" })
      .querySelector("svg"),
  ).toBeInTheDocument();
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Name" }), {
    target: { value: "Latest News" },
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "Create category" }),
  );

  expect(await within(dialog).findByRole("alert")).toHaveTextContent(
    "This taxonomy slug already exists",
  );
  expect(fetch).toHaveBeenCalledWith(
    "/api/admin/tags",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ name: "Latest News", slug: "latest-news" }),
    }),
  );
  fireEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
  await waitFor(() => expect(dialog).not.toHaveAttribute("open"));
  fireEvent.click(screen.getByRole("button", { name: "Create category" }));
  expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("");
});

it.each([401, 403, 500])(
  "shows an error instead of empty taxonomy for HTTP %s and can retry",
  async (status) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({ error: "Request failed" }, { status }),
        )
        .mockResolvedValueOnce(listResponse([])),
    );
    renderTaxonomy();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      status === 500
        ? "Unable to load tags"
        : "Sign in with an authorized admin account",
    );
    expect(screen.queryByText("No tags found.")).not.toBeInTheDocument();
    const refreshButton = screen.getByRole("button", { name: "Refresh" });
    expect(refreshButton.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(refreshButton);
    expect(await screen.findByText("No tags found.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  },
);

it.each(["network", "malformed"])(
  "shows an error for a %s failure",
  async (failure) => {
    vi.stubGlobal(
      "fetch",
      failure === "network"
        ? vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
        : vi.fn().mockResolvedValue(Response.json({ unexpected: true })),
    );
    renderTaxonomy();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load tags",
    );
    expect(screen.queryByText("No tags found.")).not.toBeInTheDocument();
  },
);
