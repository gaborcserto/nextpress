import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialMediaQuery, MediaBrowser } from "./MediaBrowser";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

const emptyCollection = { items: [], hasMore: false, page: 1 };

function renderBrowser(query = initialMediaQuery, onQuery = vi.fn()) {
  return render(
    <MediaBrowser query={query} onQuery={onQuery} onAsset={vi.fn()} />,
  );
}

describe("MediaBrowser empty states", () => {
  it("shows the upload guidance when the library has no files", () => {
    useSWR.mockReturnValue({ data: emptyCollection });

    renderBrowser();

    expect(
      screen.getByRole("heading", { name: "No files uploaded yet" }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Upload images or documents to start building your media library.",
      ),
    ).toBeVisible();
  });

  it("shows a filter message when a search has no matches", () => {
    useSWR.mockReturnValue({ data: emptyCollection });

    renderBrowser({ ...initialMediaQuery, q: "missing" });

    expect(
      screen.getByRole("heading", { name: "No files match these filters" }),
    ).toBeVisible();
    expect(screen.queryByText(/building your media library/)).toBeNull();
  });

  it("submits the search from Enter or the embedded search button", () => {
    const onQuery = vi.fn();
    useSWR.mockReturnValue({ data: emptyCollection });
    renderBrowser(initialMediaQuery, onQuery);

    const input = screen.getByRole("textbox", { name: "Search media" });
    fireEvent.change(input, { target: { value: "cover" } });
    fireEvent.submit(input.closest("form")!);

    expect(onQuery).toHaveBeenLastCalledWith({
      ...initialMediaQuery,
      q: "cover",
    });

    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onQuery).toHaveBeenCalledTimes(2);
  });

  it("toggles sort direction and resets pagination", () => {
    const onQuery = vi.fn();
    useSWR.mockReturnValue({ data: emptyCollection });
    renderBrowser({ ...initialMediaQuery, page: 2 }, onQuery);

    const direction = screen.getByRole("button", { name: "Ascending" });
    expect(direction).toHaveAttribute("title", "Ascending");
    fireEvent.click(direction);

    expect(onQuery).toHaveBeenCalledWith({
      ...initialMediaQuery,
      page: 1,
      direction: "asc",
    });
  });

  it("switches views with equally sized accessible icon buttons", () => {
    const onView = vi.fn();
    useSWR.mockReturnValue({ data: emptyCollection });
    render(
      <MediaBrowser
        query={initialMediaQuery}
        onQuery={vi.fn()}
        onAsset={vi.fn()}
        onView={onView}
      />,
    );

    const grid = screen.getByRole("button", { name: "Grid" });
    const list = screen.getByRole("button", { name: "List" });
    expect(grid).toHaveAttribute("aria-pressed", "true");
    expect(list).toHaveAttribute("aria-pressed", "false");
    expect(grid).toHaveAttribute("title", "Grid");
    expect(grid.className).toContain("size-10");
    expect(list.className).toContain("size-10");

    fireEvent.click(list);
    expect(onView).toHaveBeenCalledWith("list");
    expect(screen.getByRole("status").closest(".overflow-hidden")).toHaveClass(
      "border",
    );
  });

  it("does not show an empty state while loading or after a request error", () => {
    useSWR
      .mockReturnValueOnce({ isLoading: true })
      .mockReturnValueOnce({ error: new Error(), isLoading: false });

    const { rerender } = renderBrowser();

    expect(screen.getByRole("status")).toHaveTextContent("Loading media");
    expect(
      screen.queryByRole("heading", { name: "No files uploaded yet" }),
    ).toBeNull();

    rerender(
      <MediaBrowser
        query={initialMediaQuery}
        onQuery={vi.fn()}
        onAsset={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Unable to load media");
    expect(
      screen.queryByRole("heading", { name: "No files uploaded yet" }),
    ).toBeNull();
  });
});
