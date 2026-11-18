import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PagesListScreen from "./PagesListScreen/PagesListScreen";
import PostsListScreen from "./PostsListScreen/PostsListScreen";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
  replace: vi.fn(),
}));

const { fetcher, apiFetch } = vi.hoisted(() => ({
  fetcher: vi.fn(),
  apiFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),

  usePathname: () => "/admin/content",

  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));

vi.mock("@/lib/api", () => ({ jsonFetcher: fetcher, apiFetch }));

vi.mock("@/ui/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/utils")>()),
  showToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();

  navigation.query = "";

  fetcher.mockImplementation(async (key: string) => {
    const page = Number(
      new URL(key, "http://localhost").searchParams.get("page"),
    );

    return {
      items: [
        {
          id: "item-1",
          title: "Example",
          slug: "example",
          status: "DRAFT",
          type: "POST",
          excerpt: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],

      page,
      limit: 50,
      total: 51,
      pages: 2,
    };
  });
});

describe.each([
  { name: "Posts", Component: PostsListScreen, endpoint: "/api/post" },

  { name: "Pages", Component: PagesListScreen, endpoint: "/api/pages" },
])("$name pagination", ({ name, Component, endpoint }) => {
  function setup() {
    const cache = new Map();

    return render(
      <SWRConfig
        value={{
          provider: () => cache,
          dedupingInterval: 0,
          shouldRetryOnError: false,
        }}
      >
        <Component />
      </SWRConfig>,
    );
  }

  it.each([
    { status: "DRAFT", publishedAt: null },
    { status: "PUBLISHED", publishedAt: "2020-01-01T00:00:00.000Z" },
    { status: "PUBLISHED", publishedAt: "2099-01-01T00:00:00.000Z" },
    { status: "PUBLISHED", publishedAt: undefined },
  ])(
    "labels updatedAt honestly for $status with publication date $publishedAt",
    async ({ status, publishedAt }) => {
      const updatedAt = "2026-11-16T12:34:56.000Z";
      fetcher.mockResolvedValue({
        items: [
          {
            id: "item-1",
            type: name === "Posts" ? "POST" : "PAGE",
            title: "Example",
            slug: "example",
            status,
            excerpt: null,
            updatedAt,
            publishedAt,
          },
        ],
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      });
      setup();
      expect(
        await screen.findByText(
          `Last modified: ${new Date(updatedAt).toLocaleString()}`,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Published:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Scheduled/i)).not.toBeInTheDocument();
    },
  );

  it.each([null, undefined])(
    "does not invent a timestamp when updatedAt is %s",
    async (updatedAt) => {
      fetcher.mockResolvedValue({
        items: [
          {
            id: "item-1",
            type: name === "Posts" ? "POST" : "PAGE",
            title: "Example",
            slug: "example",
            status: "PUBLISHED",
            excerpt: null,
            updatedAt,
          },
        ],
        page: 1,
        limit: 50,
        total: 1,
        pages: 1,
      });
      setup();

      if (name === "Posts") {
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Unable to load posts",
        );
      } else {
        expect(
          await screen.findByRole("cell", { name: "\u2014" }),
        ).toBeInTheDocument();
      }

      expect(
        screen.queryByText(/Published:|Last modified:|Invalid Date/),
      ).not.toBeInTheDocument();
    },
  );

  it("renders API metadata, boundaries and forward navigation", async () => {
    setup();

    expect(
      screen
        .getAllByRole("status")
        .some((status) => status.textContent?.includes("Loading")),
    ).toBe(true);

    await screen.findByRole("button", { name: "Delete Example" });

    expect(fetcher.mock.calls[0]?.[0]).toBe(`${endpoint}?page=1`);

    expect(
      screen.getByRole("navigation", { name: `${name} pagination` }),
    ).toHaveTextContent("Page 1 of 2. 1 to 50 of 51 results");

    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(navigation.push).toHaveBeenCalledWith("/admin/content?page=2", {
      scroll: false,
    });

    expect(screen.getByRole("link", { name: "Edit Example" })).toHaveAttribute(
      "href",
      `${name === "Posts" ? "/admin/posts" : "/admin/pages"}/item-1`,
    );
  });

  it("loads a last-page deep link and navigates backward", async () => {
    navigation.query = "page=2";

    setup();

    await screen.findByText(/Page 2 of 2/);

    expect(fetcher.mock.calls[0]?.[0]).toBe(`${endpoint}?page=2`);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(navigation.push).toHaveBeenCalledWith("/admin/content", {
      scroll: false,
    });
  });

  it("shows an empty result without inventing a page", async () => {
    fetcher.mockResolvedValue({
      items: [],
      page: 1,
      limit: 50,
      total: 0,
      pages: 0,
    });

    setup();

    await screen.findByText("No items found.");

    expect(screen.getByText("0 results")).toBeInTheDocument();

    expect(screen.queryByText(/of 1/)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("retries a failed load", async () => {
    fetcher.mockRejectedValueOnce(new Error("offline"));

    setup();

    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByRole("button", { name: "Delete Example" });
  });

  it("revalidates after confirmed deletion and returns to the last valid page", async () => {
    navigation.query = "page=2";

    apiFetch.mockResolvedValue(new Response(null, { status: 204 }));

    setup();

    await screen.findByRole("button", { name: "Delete Example" });

    fetcher.mockResolvedValue({
      items: [],
      page: 2,
      limit: 50,
      total: 50,
      pages: 1,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Example" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/admin/content", {
        scroll: false,
      }),
    );

    expect(apiFetch).toHaveBeenCalledWith(`${endpoint}/item-1`, {
      method: "DELETE",
    });
  });
});
