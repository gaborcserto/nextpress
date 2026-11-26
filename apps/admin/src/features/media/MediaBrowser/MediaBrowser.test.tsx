import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialMediaQuery, MediaBrowser } from "./MediaBrowser";

const { useSWR } = vi.hoisted(() => ({ useSWR: vi.fn() }));
vi.mock("swr", () => ({ default: useSWR }));

afterEach(() => {
  vi.restoreAllMocks();
});

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

    const search = screen.getByRole("button", { name: "Search" });
    expect(search.children).toHaveLength(1);
    expect(search.querySelector(":scope > svg")).toBeInTheDocument();
    fireEvent.click(search);
    expect(onQuery).toHaveBeenCalledTimes(2);
  });

  it("toggles sort direction and resets pagination", () => {
    const onQuery = vi.fn();
    useSWR.mockReturnValue({ data: emptyCollection });
    renderBrowser({ ...initialMediaQuery, page: 2 }, onQuery);

    const sort = within(screen.getByRole("group", { name: "Sort by" }));
    expect(sort.getByRole("combobox", { name: "Sort by" })).toHaveValue(
      "createdAt",
    );

    const direction = sort.getByRole("button", { name: "Ascending" });
    expect(direction).toHaveAttribute("title", "Ascending");
    expect(direction.children).toHaveLength(1);
    expect(direction.querySelector(":scope > svg")).toBeInTheDocument();
    expect(direction).not.toHaveAttribute("aria-busy");
    fireEvent.click(direction);

    expect(onQuery).toHaveBeenCalledWith({
      ...initialMediaQuery,
      page: 1,
      direction: "asc",
    });
  });

  it("switches views with accessible icon toggles", () => {
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

    const view = within(screen.getByRole("group", { name: "View" }));
    const grid = view.getByRole("button", { name: "Grid" });
    const list = view.getByRole("button", { name: "List" });
    expect(grid).toHaveAttribute("aria-pressed", "true");
    expect(list).toHaveAttribute("aria-pressed", "false");
    expect(grid).toHaveAttribute("title", "Grid");
    expect(grid.children).toHaveLength(1);
    expect(list.children).toHaveLength(1);
    expect(grid.querySelector(":scope > svg")).toBeInTheDocument();
    expect(list.querySelector(":scope > svg")).toBeInTheDocument();

    fireEvent.click(list);
    expect(onView).toHaveBeenCalledWith("list");
    expect(onView).toHaveBeenCalledOnce();
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

it("reveals a complete document filename from the existing asset button", () => {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(80);
  vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(240);
  const filename = "typography-and-structured-content-public-style-guide.pdf";
  const asset = {
    id: "style-guide",
    filename,
    caption: "Style guide",
    mime: "application/pdf",
    size: 1024,
    createdAt: "2026-09-25T10:00:00.000Z",
  };
  const onAsset = vi.fn();
  useSWR.mockReturnValue({ data: { ...emptyCollection, items: [asset] } });
  render(
    <MediaBrowser
      query={initialMediaQuery}
      onQuery={vi.fn()}
      onAsset={onAsset}
    />,
  );

  const button = screen.getByRole("button", { name: /Style guide/ });
  fireEvent.focus(button);

  expect(screen.getByRole("tooltip")).toHaveTextContent(filename);
  expect(button).not.toHaveAttribute("title");

  fireEvent.click(button);

  expect(onAsset).toHaveBeenCalledWith(asset);
});
