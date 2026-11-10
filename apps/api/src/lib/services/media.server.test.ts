import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, storage } = vi.hoisted(() => ({
  db: {
    media: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    page: { findMany: vi.fn() },
  },
  storage: { put: vi.fn(), read: vi.fn(), remove: vi.fn() },
}));
vi.mock("@nextpress/db/src/client", () => ({ prisma: db }));
vi.mock("./media-storage.server", () => ({ mediaStorage: storage }));

import { listMedia, serveMedia, uploadMedia } from "./media.server";

const actor = { id: "author", role: "AUTHOR" as const };
const image =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";
beforeEach(() => {
  vi.clearAllMocks();
});

describe("secure media boundaries", () => {
  it("checks the signature and complete image decoder before storage", async () => {
    await expect(
      uploadMedia({ data: image, mime: "image/jpeg", alt: "spoof" }, actor),
    ).rejects.toThrow();
    await expect(
      uploadMedia(
        { data: image.slice(0, 32), mime: "image/png", alt: "truncated" },
        actor,
      ),
    ).rejects.toThrow();
    expect(storage.put).not.toHaveBeenCalled();
    db.media.create.mockResolvedValue({ id: "asset" });
    await uploadMedia({ data: image, mime: "image/png", alt: "Image" }, actor);
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^[a-f0-9-]{36}\.png$/),
      expect.any(Buffer),
    );
    expect(db.media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          uploadedById: "author",
          mime: "image/png",
          width: 1,
          height: 1,
        }),
      }),
    );
  });

  it("rejects subscriber uploads and scopes authors' metadata", async () => {
    await expect(
      uploadMedia(
        { data: image, mime: "image/png", alt: "" },
        { id: "subscriber", role: "SUBSCRIBER" },
      ),
    ).rejects.toThrow();
    await listMedia(actor);
    expect(db.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { uploadedById: "author" } }),
    );
  });

  it("does not expose a private image through a guessed ID or text that resembles a reference", async () => {
    db.media.findUnique.mockResolvedValue({
      key: "private.png",
      uploadedById: "author",
    });
    db.page.findMany.mockResolvedValue([
      {
        coverId: null,
        pageDocument: JSON.stringify({
          version: 1,
          blocks: [
            {
              id: "fake",
              type: "hero",
              version: 1,
              props: { title: '"private"', description: "" },
            },
          ],
        }),
      },
    ]);
    await expect(serveMedia("private")).rejects.toThrow();
    expect(storage.read).not.toHaveBeenCalled();
  });

  it("removes the stored object when metadata persistence fails", async () => {
    db.media.create.mockRejectedValue(new Error("database failure"));
    await expect(
      uploadMedia({ data: image, mime: "image/png", alt: "" }, actor),
    ).rejects.toThrow("database failure");
    expect(storage.remove).toHaveBeenCalledWith(
      expect.stringMatching(/\.png$/),
    );
  });
});
