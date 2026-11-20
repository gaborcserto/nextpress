import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPostList } from "@/components/admin/PostsListScreen/postListFetcher";

import { useContentList } from "./useContentList";

import type { ReactNode } from "react";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
  replace: vi.fn(),
}));
const { fetcher } = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.query),
  usePathname: () => "/admin/posts",
  useRouter: () => ({ push: navigation.push, replace: navigation.replace }),
}));
vi.mock("@/lib/api", () => ({ jsonFetcher: fetcher }));

const response = (page = 1, total = 101) => ({
  items: [
    {
      id: `item-${page}`,
      type: "POST",
      status: "DRAFT",
      publishedAt: null,
      publicationState: "DRAFT",
      slug: `item-${page}`,
      title: `Item ${page}`,
      excerpt: null,
      updatedAt: "2026-11-16T12:00:00.000Z",
    },
  ],
  page,
  limit: 50,
  total,
  pages: Math.ceil(total / 50),
});

function setup(usePostFetcher = false) {
  const cache = new Map();

  return renderHook(
    () =>
      useContentList("/api/post", usePostFetcher ? fetchPostList : undefined),
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <SWRConfig
          value={{
            provider: () => cache,
            dedupingInterval: 0,
            shouldRetryOnError: false,
          }}
        >
          {children}
        </SWRConfig>
      ),
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  navigation.query = "";
  fetcher.mockImplementation(async (key: string) =>
    response(Number(new URL(key, "http://localhost").searchParams.get("page"))),
  );
});

describe("content list URL pagination", () => {
  it("defaults to page one, navigates with query preservation and restores history", async () => {
    navigation.query = "filter=draft";
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.pagination.busy).toBe(false));
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/post?page=1");
    act(() => {
      result.current.pagination.onPageAction(2);
      result.current.pagination.onPageAction(2);
    });
    expect(navigation.push).toHaveBeenCalledExactlyOnceWith(
      "/admin/posts?filter=draft&page=2",
      { scroll: false },
    );
    navigation.query = "filter=draft&page=2";
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-2"));
    expect(result.current.pagination.metadata).toMatchObject({
      page: 2,
      pages: 3,
      total: 101,
      limit: 50,
    });
    act(() => result.current.pagination.onPageAction(1));
    expect(navigation.push).toHaveBeenLastCalledWith(
      "/admin/posts?filter=draft",
      { scroll: false },
    );
    navigation.query = "filter=draft";
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-1"));
    navigation.query = "filter=draft&page=2";
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-2"));
  });

  it.each([
    "0",
    "-1",
    "1.5",
    "abc",
    "10001",
    "999999999999999999999",
    "",
    "2&page=3",
    "1",
    "02",
  ])("normalizes page=%s safely", async (value) => {
    navigation.query = `page=${value}&filter=draft`;
    const { result } = setup();
    const page = value === "02" ? 2 : 1;
    await waitFor(() => expect(result.current.pagination.busy).toBe(false));
    expect(fetcher.mock.calls[0]?.[0]).toBe(`/api/post?page=${page}`);
    expect(navigation.replace).toHaveBeenCalledWith(
      `/admin/posts?filter=draft${page === 1 ? "" : "&page=2"}`,
      { scroll: false },
    );
  });

  it("applies list filters from page one and restores them when going back", async () => {
    navigation.query = "page=2&q=old&status=DRAFT";
    const { result, rerender } = setup();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-2"));
    expect(fetcher).toHaveBeenCalledWith("/api/post?page=2&q=old&status=DRAFT");

    const filters = new FormData();
    filters.set("q", " new ");
    filters.set("tag", "news");
    act(() => result.current.query.onApplyAction(filters));

    expect(navigation.push).toHaveBeenCalledWith(
      "/admin/posts?q=new&tag=news",
      { scroll: false },
    );
    navigation.query = "q=new&tag=news";
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-1"));
    expect(fetcher).toHaveBeenCalledWith("/api/post?page=1&q=new&tag=news");

    navigation.query = "page=2&q=old&status=DRAFT";
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-2"));
    expect(result.current.query.values.get("status")).toBe("DRAFT");
  });

  it("loads a later deep link and enforces boundaries", async () => {
    navigation.query = "page=3";
    const { result } = setup();
    await waitFor(() => expect(result.current.pagination.busy).toBe(false));
    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/post?page=3");
    act(() => result.current.pagination.onPageAction(4));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("corrects the page after deletion revalidation reduces the total", async () => {
    navigation.query = "page=3";
    const { result } = setup();
    await waitFor(() => expect(result.current.pagination.busy).toBe(false));
    fetcher.mockResolvedValue(response(3, 100));
    await act(async () => {
      await result.current.mutate();
    });
    expect(navigation.replace).toHaveBeenCalledWith("/admin/posts?page=2", {
      scroll: false,
    });
    expect(result.current.isLoading).toBe(true);
  });

  it("keeps zero pages authoritative for empty results", async () => {
    fetcher.mockResolvedValue({ ...response(1, 0), items: [] });
    const { result } = setup();
    await waitFor(() => expect(result.current.pagination.busy).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.pagination.metadata?.pages).toBe(0);
    act(() => result.current.pagination.onPageAction(2));
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("retains a retry path after request failure", async () => {
    fetcher.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup();
    await waitFor(() => expect(result.current.error).toBeDefined());
    await act(async () => {
      await result.current.mutate();
    });
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-1"));
    expect(result.current.error).toBeUndefined();
  });

  it("does not allow an old response to replace the selected page", async () => {
    let resolveOld: (value: ReturnType<typeof response>) => void = () =>
      undefined;
    fetcher.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const { result, rerender } = setup();
    navigation.query = "page=2";
    rerender();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("item-2"));
    await act(async () => {
      resolveOld(response(1));
    });
    expect(result.current.items[0]?.id).toBe("item-2");
  });
});

it("rejects invalid post data and recovers on retry", async () => {
  fetcher.mockResolvedValueOnce({ items: "bad", page: 1 });
  const { result } = setup(true);
  await waitFor(() => expect(result.current.error).toBeDefined());
  expect(result.current.items).toEqual([]);
  expect(result.current.pagination.metadata).toBeUndefined();
  expect(result.current.isLoading).toBe(false);

  fetcher.mockResolvedValueOnce({
    items: [
      {
        id: "post-1",
        type: "POST",
        status: "DRAFT",
        publishedAt: null,
        publicationState: "DRAFT",
        slug: "post",
        title: "Post",
        excerpt: null,
        updatedAt: "2026-11-16T12:00:00.000Z",
      },
    ],
    page: 1,
    limit: 50,
    total: 1,
    pages: 1,
  });
  await act(async () => {
    await result.current.mutate();
  });
  await waitFor(() => expect(result.current.items[0]?.id).toBe("post-1"));
  expect(result.current.error).toBeUndefined();
});
