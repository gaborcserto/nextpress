import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PagesListScreen from "@/features/pages/PagesListScreen/PagesListScreen";
import PostsListScreen from "@/features/posts/PostsListScreen/PostsListScreen";

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

vi.mock("@/lib/api", () => ({
  jsonFetcher: (url: string) =>
    url === "/api/discovery/session"
      ? Promise.resolve({ user: { id: "user", name: "User", role: "ADMIN" } })
      : url.startsWith("/api/admin/tags?")
        ? Promise.resolve({
            items: [],
            page: 1,
            limit: 100,
            total: 0,
            pages: 1,
          })
        : fetcher(url),
  apiFetch,
}));

vi.mock("@/ui/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/ui/utils")>()),
  showToast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  apiFetch.mockReset();
  fetcher.mockReset();

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
          publishedAt: null,
          publicationState: "DRAFT",
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
  {
    name: "Posts",
    Component: PostsListScreen,
    endpoint: "/api/post",
    kind: "POST",
    editHref: "/admin/posts/item-1",
  },
  {
    name: "Pages",
    Component: PagesListScreen,
    endpoint: "/api/pages",
    kind: "PAGE",
    editHref: "/admin/pages/item-1",
  },
])("$name list", ({ name, Component, endpoint, kind, editHref }) => {
  function renderList() {
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

  function mockSingleItem(item: {
    status: "DRAFT" | "PUBLISHED";
    updatedAt: string | null | undefined;
    publishedAt?: string | null | undefined;
  }) {
    const publishedAt = item.publishedAt ?? null;
    fetcher.mockResolvedValue({
      items: [
        {
          id: "item-1",
          type: kind,
          title: "Example",
          slug: "example",
          excerpt: null,
          ...item,
          publishedAt,
          publicationState:
            item.status === "DRAFT"
              ? "DRAFT"
              : publishedAt === null
                ? "MISSING_DATE"
                : publishedAt > new Date().toISOString()
                  ? "SCHEDULED"
                  : "PUBLISHED",
        },
      ],
      page: 1,
      limit: 50,
      total: 1,
      pages: 1,
    });
  }

  it.each([
    { scenario: "draft", status: "DRAFT", publishedAt: null, label: "Draft" },
    {
      scenario: "past publication date",
      status: "PUBLISHED",
      publishedAt: "2020-01-01T00:00:00.000Z",
      label: "Published",
    },
    {
      scenario: "future publication date",
      status: "PUBLISHED",
      publishedAt: "2099-01-01T00:00:00.000Z",
      label: "Scheduled",
    },
    {
      scenario: "missing publication date",
      status: "PUBLISHED",
      publishedAt: undefined,
      label: "Publication date missing",
    },
  ] as const)(
    "shows the modified date and publication metadata for $scenario",
    async ({ status, publishedAt, label }) => {
      const updatedAt = "2026-11-16T12:34:56.000Z";
      mockSingleItem({ status, updatedAt, publishedAt });

      renderList();

      const row = await screen.findByRole("row", { name: /Example/ });
      expect(within(row).getByText(label, { exact: true })).toBeVisible();
      expect(
        screen.getByRole("columnheader", { name: "Created" }),
      ).toBeVisible();
      expect(
        screen.getByRole("columnheader", {
          name: "Last modified",
        }),
      ).toBeVisible();
      const times = Array.from(
        row.querySelectorAll("time"),
        (time) => time.dateTime,
      );
      expect(times).toEqual(
        publishedAt ? [publishedAt, updatedAt] : [updatedAt],
      );
    },
  );

  it.each([null, undefined])(
    "does not invent a timestamp when updatedAt is %s",
    async (updatedAt) => {
      mockSingleItem({ status: "PUBLISHED", updatedAt });

      renderList();

      if (name === "Posts") {
        expect(await screen.findByRole("alert")).toHaveTextContent(
          "Unable to load posts",
        );
      } else {
        expect(
          (await screen.findByRole("row", { name: /Example/ })).querySelector(
            "time",
          ),
        ).toBeNull();
      }

      expect(
        screen.queryByText(/Published:|Last modified:|Invalid Date/),
      ).not.toBeInTheDocument();
    },
  );

  it("renders API metadata, boundaries and forward navigation", async () => {
    renderList();

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
      editHref,
    );
  });

  it("loads a last-page deep link and navigates backward", async () => {
    navigation.query = "page=2";

    renderList();

    await screen.findByText(/Page 2 of 2/);

    expect(fetcher.mock.calls[0]?.[0]).toBe(`${endpoint}?page=2`);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Previous" }));

    expect(navigation.push).toHaveBeenCalledWith("/admin/content", {
      scroll: false,
    });
  });

  it("preserves server ordering and applies status and header sorting from the first page", async () => {
    navigation.query = "page=2&view=compact&sort=title&direction=desc";
    fetcher.mockResolvedValue({
      items: [
        {
          id: "old",
          title: "Zulu",
          status: "DRAFT",
          publishedAt: null,
          publicationState: "DRAFT",
          updatedAt: "2025-02-01T00:00:00Z",
        },
        {
          id: "new",
          title: "Alpha",
          status: "PUBLISHED",
          publishedAt: "2099-01-01T00:00:00Z",
          publicationState: "SCHEDULED",
          updatedAt: "2026-12-01T00:00:00Z",
        },
      ].map((item) => ({
        ...item,
        slug: item.id,
        type: kind,
        excerpt: null,
      })),
      page: 2,
      limit: 50,
      total: 52,
      pages: 2,
    });
    renderList();

    const table = await screen.findByRole("table", { name });
    const firstRow = within(table).getAllByRole("row")[1];
    expect(within(firstRow).getByRole("link", { name: "Zulu" })).toBeVisible();
    const requestedPage = `${endpoint}?page=2&sort=title&direction=desc`;
    expect(
      fetcher.mock.calls.filter(([url]) => url === requestedPage),
    ).toHaveLength(1);

    fireEvent.click(within(table).getByRole("button", { name: "Title" }));

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/admin/content?view=compact&sort=title&direction=asc",
      { scroll: false },
    );
    navigation.push.mockClear();

    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "SCHEDULED" },
    });

    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/admin/content?view=compact&sort=title&direction=desc&status=SCHEDULED",
      { scroll: false },
    );
  });

  it("shows an empty result without inventing a page", async () => {
    fetcher.mockResolvedValue({
      items: [],
      page: 1,
      limit: 50,
      total: 0,
      pages: 0,
    });

    renderList();

    await screen.findByText("No items found.");

    expect(screen.getByText("0 results")).toBeInTheDocument();

    expect(screen.queryByText(/of 1/)).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("retries a failed load", async () => {
    fetcher.mockRejectedValueOnce(new Error("offline"));

    renderList();

    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await screen.findByRole("button", { name: "Delete Example" });
  });

  it("revalidates after confirmed deletion and returns to the last valid page", async () => {
    navigation.query = "page=2";

    apiFetch.mockResolvedValue(new Response(null, { status: 204 }));

    renderList();

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
