import { afterEach, describe, expect, it, vi } from "vitest";

import { loadEntityTagsAction, loadTagOptionsAction, loadTagsAdminAction, updateEntityTagsAction } from "./tag.client";
import { ApiRequestError } from "@/lib/api/client";

describe("Tag request failures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    () => loadEntityTagsAction("page-1"),
    () => loadTagOptionsAction("news"),
    () => updateEntityTagsAction("page-1", ["tag-1"]),
  ])("rejects unsuccessful responses so the UI can show failure", async (request) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(request()).rejects.toThrow(/Failed to/);
  });

  it.each([401, 403, 500])("preserves taxonomy HTTP status %s", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Request failed" }, { status })));
    await expect(loadTagsAdminAction()).rejects.toBeInstanceOf(ApiRequestError);
    await expect(loadTagsAdminAction()).rejects.toMatchObject({ status });
  });

  it("loads taxonomy records and usage counts through the admin endpoint", async () => {
    const tags = [{ id: "tag-1", name: "News", slug: "news", usedCount: 3 }];
    const fetchMock = vi.fn().mockResolvedValue(Response.json(tags));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadTagsAdminAction()).resolves.toEqual(tags);
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/tags", { cache: "no-store" });
  });

  it("accepts a genuinely empty taxonomy", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(loadTagsAdminAction()).resolves.toEqual([]);
  });

  it.each([{}, { error: "unexpected" }, [{ id: "tag", name: "Tag", slug: "tag", usedCount: -1 }]])(
    "rejects malformed successful responses instead of returning an empty taxonomy",
    async (payload) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
      await expect(loadTagsAdminAction()).rejects.toThrow("Invalid tag response");
    },
  );
});
