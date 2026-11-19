import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import TaxonomyScreen from "./TaxonomyScreen";

afterEach(() => vi.unstubAllGlobals());

it("announces loading without showing an empty state", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {})),
  );
  render(<TaxonomyScreen />);
  expect(screen.getByRole("status")).toHaveTextContent(/Loading tags/);
  expect(screen.queryByText("No tags found.")).not.toBeInTheDocument();
});

it("renders records, slugs, and zero, single, and multiple post usage counts", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json([
        { id: "unused", name: "Unused", slug: "unused-tag", usedCount: 0 },
        { id: "one", name: "One", slug: "one-tag", usedCount: 1 },
        { id: "many", name: "Many", slug: "many-tag", usedCount: 3 },
      ]),
    ),
  );
  render(<TaxonomyScreen />);
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
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
  render(<TaxonomyScreen />);
  expect(await screen.findByText("No tags found.")).toBeInTheDocument();
});

it("sorts post counts numerically in both directions", async () => {
  const fetch = vi.fn().mockResolvedValue(
    Response.json([
      { id: "two", name: "Two", slug: "two", usedCount: 2 },
      { id: "twelve", name: "Twelve", slug: "twelve", usedCount: 12 },
    ]),
  );
  vi.stubGlobal("fetch", fetch);
  render(<TaxonomyScreen />);

  const sort = await screen.findByRole("button", { name: "Posts" });

  const firstRow = () => screen.getAllByRole("row")[1];
  expect(firstRow()).toHaveTextContent("Twelve");
  fireEvent.click(sort);
  expect(firstRow()).toHaveTextContent("Two");
  expect(sort.closest("th")).toHaveAttribute("aria-sort", "ascending");
  fireEvent.click(sort);
  expect(firstRow()).toHaveTextContent("Twelve");
  expect(fetch).toHaveBeenCalledTimes(1);
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
        .mockResolvedValueOnce(Response.json([])),
    );
    render(<TaxonomyScreen />);
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
    render(<TaxonomyScreen />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to load tags",
    );
    expect(screen.queryByText("No tags found.")).not.toBeInTheDocument();
  },
);
