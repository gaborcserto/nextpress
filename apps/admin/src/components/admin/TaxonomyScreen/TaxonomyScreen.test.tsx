import { fireEvent, render, screen, within } from "@testing-library/react";
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
  expect(deleteButton).toHaveClass("btn-error", "btn-soft");
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

it("loads categories and submits search and usage sorting through the URL", async () => {
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
  expect(
    screen.queryByRole("button", { name: "Create tag" }),
  ).not.toBeInTheDocument();
  expect(fetch.mock.calls[0]?.[0]).toBe("/api/admin/tags?page=2&type=CATEGORY");

  fireEvent.change(screen.getByRole("searchbox", { name: "Search" }), {
    target: { value: "News" },
  });
  fireEvent.change(screen.getByLabelText("Sort by"), {
    target: { value: "usedCount" },
  });
  fireEvent.change(screen.getByLabelText("Sort direction"), {
    target: { value: "desc" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));

  expect(navigation.push).toHaveBeenCalledWith(
    "/admin/taxonomy?type=CATEGORY&q=News&sort=usedCount&direction=desc",
    { scroll: false },
  );
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
