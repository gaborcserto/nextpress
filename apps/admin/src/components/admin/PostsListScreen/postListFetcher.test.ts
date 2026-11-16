import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPostList } from "./postListFetcher";

const valid = {
  items: [
    {
      id: "one",
      type: "POST",
      status: "DRAFT",
      slug: "one",
      title: "One",
      excerpt: null,
      updatedAt: "2026-11-16T12:00:00.000Z",
      extra: "preserved",
    },
  ],
  page: 1,
  limit: 50,
  total: 1,
  pages: 1,
  extra: true,
};

afterEach(() => vi.unstubAllGlobals());

describe("post list response boundary", () => {
  it("accepts valid data and preserves additional fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(valid))),
    );
    await expect(fetchPostList("/api/post")).resolves.toEqual(valid);
  });

  it.each([
    { ...valid, items: "wrong" },
    { ...valid, page: undefined },
    { ...valid, page: "1" },
  ])("rejects an invalid response", async (body) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
    );
    await expect(fetchPostList("/api/post")).rejects.toThrow(
      "Invalid post list response",
    );
  });

  it("preserves malformed JSON errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{")));
    await expect(fetchPostList("/api/post")).rejects.toBeInstanceOf(
      SyntaxError,
    );
  });

  it("preserves HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"error":"Forbidden"}', { status: 403 }),
        ),
    );
    await expect(fetchPostList("/api/post")).rejects.toMatchObject({
      name: "ApiRequestError",
      status: 403,
      message: "Forbidden",
    });
  });

  it("preserves network errors", async () => {
    const error = new Error("offline");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(fetchPostList("/api/post")).rejects.toBe(error);
  });
});
