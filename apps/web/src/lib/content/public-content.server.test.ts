import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PublicApiError } from "./public-api.server";
import {
  getPublishedPage,
  getPublishedPost,
  getPublishedPosts,
  getPublicPageNavigation,
} from "./public-content.server";

const request = vi.fn();
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", request);
  request.mockReset();
  vi.stubEnv("API_INTERNAL_ORIGIN", "http://api.test:49102");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const post = {
  slug: "hello",
  title: "Hello",
  summary: "Summary",
  publishedAt: "2025-01-01T00:00:00.000Z",
  author: { name: "Author" },
  taxonomies: [],
  content: {
    version: 1,
    blocks: [{ type: "paragraph", children: [{ text: "Hello" }] }],
  },
  cover: null,
};

describe("public HTTP content", () => {
  it("logs redacted failure classification without upstream error details", async () => {
    request.mockRejectedValue(new Error("private-connection-details"));
    await expect(getPublishedPosts()).rejects.toThrow(
      "temporarily unavailable",
    );
    expect(console.error).toHaveBeenCalledWith(
      JSON.stringify({
        event: "public.upstream.failed",
        code: "transport",
        status: 503,
      }),
    );
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(
      "private-connection-details",
    );
  });
  it.each([getPublishedPage, getPublishedPost])(
    "validates delivery content and sends anonymous uncached requests",
    async (read) => {
      request.mockResolvedValue(Response.json(post));
      expect(await read("hello")).toEqual(post);
      expect(request).toHaveBeenCalledWith(
        expect.stringMatching(
          /http:\/\/api.test:49102\/api\/public\/(posts|pages)\/hello/,
        ),
        expect.objectContaining({
          credentials: "omit",
          cache: "no-store",
          redirect: "error",
          signal: expect.any(AbortSignal),
        }),
      );
    },
  );
  it("only maps a detail 404 to missing content", async () => {
    request.mockResolvedValue(new Response(null, { status: 404 }));
    expect(await getPublishedPage("missing")).toBeNull();
    await expect(getPublishedPosts()).rejects.toMatchObject({ status: 404 });
  });
  it.each([401, 403, 500, 503])(
    "preserves upstream failure %i",
    async (status) => {
      request.mockResolvedValue(new Response(null, { status }));
      await expect(getPublishedPost("hello")).rejects.toMatchObject({
        status,
        code: "upstream",
      });
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("rejects private fields and malformed rich documents", async () => {
    for (const body of [
      { ...post, author: { name: "Author", email: "private" } },
      { ...post, content: { version: 2 } },
    ]) {
      request.mockResolvedValue(Response.json(body));
      await expect(getPublishedPost("hello")).rejects.toMatchObject({
        code: "contract",
      });
    }
  });
  it("reports outages without leaking upstream details or retrying", async () => {
    request.mockRejectedValue(new Error("secret upstream address"));
    await expect(getPublishedPost("hello")).rejects.toBeInstanceOf(
      PublicApiError,
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["UPPER", "bad/slug", "%2f", " padded "])(
    "does not request invalid slug %s",
    async (slug) => {
      expect(await getPublishedPage(slug)).toBeNull();
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("bounds pagination before sending it", async () => {
    request.mockImplementation(async () =>
      Response.json({ posts: [], hasMore: false }),
    );
    await getPublishedPosts({ limit: 500, offset: 1_000_000 });
    expect(request.mock.lastCall?.[0]).toContain("limit=50&offset=100000");
    await getPublishedPosts({ limit: NaN, offset: NaN });
    expect(request.mock.lastCall?.[0]).toContain("limit=10&offset=0");
  });
  it("reads navigation over the public endpoint", async () => {
    request.mockResolvedValue(Response.json({ header: [], footer: [] }));
    expect(await getPublicPageNavigation()).toEqual({ header: [], footer: [] });
  });
});
