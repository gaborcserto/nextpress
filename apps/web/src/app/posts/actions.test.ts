import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedPosts, getPublicSiteSettings } = vi.hoisted(() => ({
  getPublishedPosts: vi.fn(),
  getPublicSiteSettings: vi.fn(),
}));

vi.mock("@/lib/content/public-content.server", () => ({ getPublishedPosts }));
vi.mock("@/lib/settings/public-site-settings.server", () => ({ getPublicSiteSettings }));

import { getNextPostBatch } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  getPublicSiteSettings.mockResolvedValue({ postListingMode: "LOAD_MORE", postsPerPage: 20 });
  getPublishedPosts.mockResolvedValue({ posts: [], hasMore: false });
});

describe("Load more server action", () => {
  it("uses the configured batch size and existing published reader", async () => {
    expect(await getNextPostBatch(2)).toEqual({ posts: [], hasMore: false });
    expect(getPublishedPosts).toHaveBeenCalledWith({ limit: 20, offset: 20 });
  });

  it.each([1, 2.5, 10_002, Number.NaN])("rejects invalid or unbounded page %s", async (page) => {
    await expect(getNextPostBatch(page)).resolves.toBeNull();
    expect(getPublishedPosts).not.toHaveBeenCalled();
  });

  it("disables the action if the site mode is no longer Load more", async () => {
    getPublicSiteSettings.mockResolvedValue({ postListingMode: "PAGINATION", postsPerPage: 20 });
    await expect(getNextPostBatch(2)).resolves.toBeNull();
    expect(getPublishedPosts).not.toHaveBeenCalled();
  });
});
