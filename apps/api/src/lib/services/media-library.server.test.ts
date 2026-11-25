import { MediaLibraryBrowseSchema } from "@nextpress/shared/media";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentForbiddenError } from "@/lib/auth/content-access";

import { browseMedia } from "./media-library.server";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@nextpress/db/src/client", () => ({
  prisma: { media: { findMany } },
}));

beforeEach(() => {
  findMany.mockReset();
});

describe("asset library", () => {
  it("uses one owner-scoped query for a globally ordered mixed page", async () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({
      id: String(index),
      mime: index % 2 ? "application/pdf" : "image/webp",
    }));
    findMany.mockResolvedValue(rows);
    const query = MediaLibraryBrowseSchema.parse({
      kind: "all",
      page: 2,
      sort: "filename",
      direction: "asc",
      q: "report",
    });

    const result = await browseMedia(
      query,
      { id: "owner", role: "AUTHOR" },
      query.kind,
    );

    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          uploadedById: "owner",
          OR: ["filename", "alt", "caption", "description"].map((column) => ({
            [column]: { contains: "report", mode: "insensitive" },
          })),
        },
        orderBy: [{ filename: { sort: "asc", nulls: "last" } }, { id: "asc" }],
        skip: 24,
        take: 25,
      }),
    );
    expect(result).toEqual({ items: rows.slice(0, 24), hasMore: true });
  });

  it("keeps the original image-only default and supports the document filter", async () => {
    findMany.mockResolvedValue([]);
    const actor = { id: "editor", role: "EDITOR" } as const;
    const query = MediaLibraryBrowseSchema.parse({});

    await browseMedia(query, actor, query.kind);
    await browseMedia(query, actor, "document");

    expect(findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { mime: { not: "application/pdf" } },
      }),
    );
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { mime: "application/pdf" },
      }),
    );
  });

  it("rejects a subscriber before querying assets", async () => {
    const query = MediaLibraryBrowseSchema.parse({ kind: "all" });

    await expect(
      browseMedia(query, { id: "subscriber", role: "SUBSCRIBER" }, query.kind),
    ).rejects.toThrow(ContentForbiddenError);
    expect(findMany).not.toHaveBeenCalled();
  });
});
