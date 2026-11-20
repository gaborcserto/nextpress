import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";
import { afterEach, expect, it, vi } from "vitest";

import { useContentList } from "@/lib/content/useContentList";

import { PostListResponseError } from "./postListFetcher";
import PostsListScreen from "./PostsListScreen";
import { usePostsList } from "./PostsListScreen.hooks";

import type { ReactNode } from "react";
import type { SWRConfiguration } from "swr";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/posts",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const api = await importOriginal<typeof import("@/lib/api")>();

  return {
    ...api,
    jsonFetcher: (url: string, init?: RequestInit) =>
      url === "/api/discovery/session"
        ? Promise.resolve({ user: { id: "user", name: "User", role: "ADMIN" } })
        : api.jsonFetcher(url, init),
  };
});

const list = (title: string) => ({
  items: [
    {
      id: "one",
      type: "POST",
      status: "DRAFT",
      publishedAt: null,
      publicationState: "DRAFT",
      slug: "one",
      title,
      excerpt: null,
      updatedAt: "2026-11-16T12:00:00.000Z",
    },
  ],
  page: 1,
  limit: 50,
  total: 1,
  pages: 1,
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200 });
}

function setup() {
  const cache = new Map();
  const retries: Array<() => void> = [];

  const onErrorRetry: NonNullable<SWRConfiguration["onErrorRetry"]> = (
    _error,
    _key,
    _config,
    revalidate,
    options,
  ) => {
    retries.push(() => revalidate(options));
  };

  const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig
      value={{ provider: () => cache, dedupingInterval: 0, onErrorRetry }}
    >
      {children}
    </SWRConfig>
  );

  return { cache, retries, wrapper };
}

afterEach(() => vi.unstubAllGlobals());

it("does not schedule schema retries and allows manual recovery", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ items: "invalid" }))
    .mockResolvedValueOnce(json(list("Recovered")));
  vi.stubGlobal("fetch", fetch);
  const { wrapper, retries } = setup();
  const { result } = renderHook(() => usePostsList(), { wrapper });

  await waitFor(() =>
    expect(result.current.error).toBeInstanceOf(PostListResponseError),
  );
  expect(retries).toHaveLength(0);
  expect(fetch).toHaveBeenCalledTimes(1);

  await act(async () => {
    await result.current.mutate();
  });

  expect(result.current.items[0]?.title).toBe("Recovered");
  expect(result.current.error).toBeUndefined();
});

it.each(["network", "http", "malformed JSON"])(
  "keeps automatic retry for %s failures",
  async (failure) => {
    const fetch = vi.fn();

    if (failure === "network") {
      fetch.mockRejectedValueOnce(new Error("offline"));
    } else if (failure === "http") {
      fetch.mockResolvedValueOnce(new Response("unavailable", { status: 503 }));
    } else {
      fetch.mockResolvedValueOnce(new Response("{"));
    }

    fetch.mockResolvedValueOnce(json(list("Recovered")));
    vi.stubGlobal("fetch", fetch);
    const { wrapper, retries } = setup();
    const { result } = renderHook(() => usePostsList(), { wrapper });

    await waitFor(() => expect(retries).toHaveLength(1));
    expect(fetch).toHaveBeenCalledTimes(1);

    act(() => retries[0]?.());
    await waitFor(() =>
      expect(result.current.items[0]?.title).toBe("Recovered"),
    );

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeUndefined();
  },
);

it("retains retry behavior for another content list consumer", async () => {
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(json(list("Recovered")));
  vi.stubGlobal("fetch", fetch);
  const { wrapper, retries } = setup();
  const { result } = renderHook(() => useContentList("/api/pages"), {
    wrapper,
  });

  await waitFor(() => expect(retries).toHaveLength(1));

  act(() => retries[0]?.());
  await waitFor(() => expect(result.current.items[0]?.title).toBe("Recovered"));

  expect(fetch).toHaveBeenCalledTimes(2);
});

it("retains cached data after invalid revalidation and replaces it after recovery", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(list("Original")))
    .mockResolvedValueOnce(json({ items: "invalid" }))
    .mockResolvedValueOnce(json(list("Updated")));
  vi.stubGlobal("fetch", fetch);
  const { wrapper, cache } = setup();
  const { result } = renderHook(() => usePostsList(), { wrapper });
  await waitFor(() => expect(result.current.items[0]?.title).toBe("Original"));
  expect(result.current.pagination.metadata).toMatchObject({
    total: 1,
    page: 1,
  });

  await act(async () => {
    await result.current.mutate();
  });

  expect(result.current.error).toBeInstanceOf(PostListResponseError);
  expect(result.current.items[0]?.title).toBe("Original");
  expect(result.current.pagination.metadata).toMatchObject({
    total: 1,
    page: 1,
  });
  expect(cache.get("/api/post?page=1").data).toEqual(list("Original"));

  await act(async () => {
    await result.current.mutate();
  });

  expect(result.current.items[0]?.title).toBe("Updated");
  expect(result.current.error).toBeUndefined();
  expect(cache.get("/api/post?page=1").data).toEqual(list("Updated"));
});

it("shows the posts error and recovers through the Retry control", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json({ items: "invalid" }))
    .mockResolvedValueOnce(json(list("Updated")));
  vi.stubGlobal("fetch", fetch);
  const { wrapper } = setup();
  render(<PostsListScreen />, { wrapper });

  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Unable to load posts. Please try again.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("link", { name: "Edit Updated" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

it("hides retained posts while displaying a revalidation error", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(list("Original")))
    .mockResolvedValueOnce(json({ items: "invalid" }))
    .mockResolvedValueOnce(json(list("Updated")));
  vi.stubGlobal("fetch", fetch);
  const { wrapper, cache } = setup();

  function Revalidate() {
    const { mutate } = usePostsList();

    return <button onClick={() => void mutate()}>Revalidate</button>;
  }

  render(
    <>
      <PostsListScreen />
      <Revalidate />
    </>,
    { wrapper },
  );
  await screen.findByRole("link", { name: "Edit Original" });
  fireEvent.click(screen.getByRole("button", { name: "Revalidate" }));
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("link", { name: "Edit Original" }),
  ).not.toBeInTheDocument();
  expect(cache.get("/api/post?page=1").data).toEqual(list("Original"));
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await screen.findByRole("link", { name: "Edit Updated" });
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});
