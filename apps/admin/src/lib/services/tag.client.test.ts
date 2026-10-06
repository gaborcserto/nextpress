import { afterEach, describe, expect, it, vi } from "vitest";

import { loadEntityTagsAction, loadTagOptionsAction, loadTagsAdminAction, updateEntityTagsAction } from "./tag.client";

describe("Tag request failures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    () => loadEntityTagsAction("page-1"),
    () => loadTagOptionsAction("news"),
    () => loadTagsAdminAction(),
    () => updateEntityTagsAction("page-1", ["tag-1"]),
  ])("rejects unsuccessful responses so the UI can show failure", async (request) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    await expect(request()).rejects.toThrow(/Failed to/);
  });
});
