import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, storage } = vi.hoisted(() => ({
  db: {
    media: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
    page: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
  storage: { put: vi.fn(), read: vi.fn(), remove: vi.fn() },
}));
vi.mock("@nextpress/db/src/client", () => ({ prisma: db }));
vi.mock("./media-storage.server", () => ({ mediaStorage: storage }));

import {
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";

import {
  deleteMedia,
  listMedia,
  MediaReferencedError,
  serveMedia,
  uploadMedia,
} from "./media.server";

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

  it("requires a due publication before reading anonymously referenced media", async () => {
    db.media.findUnique.mockResolvedValue({ key: "asset.png" });
    db.page.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ coverId: "asset" }]);
    storage.read.mockResolvedValue(new Uint8Array([1, 2]));

    await expect(serveMedia("asset")).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    expect(db.page.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PUBLISHED",
          publishedAt: { not: null, lte: expect.any(Date) },
          OR: [{ coverId: "asset" }, { pageDocument: { contains: '"asset"' } }],
        },
      }),
    );
    expect(storage.read).not.toHaveBeenCalled();

    const response = await serveMedia("asset");

    expect(response.status).toBe(200);
    expect(storage.read).toHaveBeenCalledWith("asset.png");
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

describe("media deletion transaction characterization", () => {
  const key = "00000000-0000-0000-0000-000000000001.png";
  let metadataPresent: boolean;
  let filePresent: boolean;
  const tx = {
    $executeRaw: vi.fn(),
    media: { findUnique: vi.fn(), delete: vi.fn() },
    page: { count: vi.fn() },
    pageRevision: { count: vi.fn() },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    metadataPresent = true;
    filePresent = true;
    tx.media.findUnique.mockImplementation(async () =>
      metadataPresent ? { key, uploadedById: "author" } : null,
    );
    tx.media.delete.mockResolvedValue({});
    tx.page.count.mockResolvedValue(0);
    tx.pageRevision.count.mockResolvedValue(0);
    storage.remove.mockImplementation(async () => {
      expect(metadataPresent).toBe(false);
      filePresent = false;
    });
    db.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<string | null>) => {
        const result = await callback(tx);
        metadataPresent = false;

        return result;
      },
    );
  });

  it("commits metadata deletion and removes the file on success; a repeat is not found", async () => {
    await deleteMedia("asset", actor);
    expect(metadataPresent).toBe(false);
    expect(filePresent).toBe(false);
    await expect(deleteMedia("asset", actor)).rejects.toBeInstanceOf(
      ContentNotFoundError,
    );
    expect(storage.remove).toHaveBeenCalledTimes(1);
  });

  it("preserves the file when metadata deletion fails", async () => {
    tx.media.delete.mockRejectedValue(new Error("database failure"));
    await expect(deleteMedia("asset", actor)).rejects.toThrow(
      "database failure",
    );
    expect(metadataPresent).toBe(true);
    expect(filePresent).toBe(true);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("preserves the file when commit fails after the callback", async () => {
    db.$transaction.mockImplementation(
      async (callback: (client: typeof tx) => Promise<string | null>) => {
        await callback(tx);
        throw new Error("commit failure");
      },
    );
    await expect(deleteMedia("asset", actor)).rejects.toThrow("commit failure");
    expect(metadataPresent).toBe(true);
    expect(filePresent).toBe(true);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it.each(["EACCES", "ENOENT"])(
    "commits metadata when cleanup reports %s",
    async (code) => {
      const failure = Object.assign(new Error("private path"), { code });
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      filePresent = code !== "ENOENT";
      storage.remove.mockRejectedValue(failure);
      await expect(deleteMedia("asset", actor)).resolves.toBeUndefined();
      expect(metadataPresent).toBe(false);
      expect(filePresent).toBe(code !== "ENOENT");

      if (code === "ENOENT") {
        expect(log).not.toHaveBeenCalled();
      } else {
        expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({
          event: "media.cleanup_failed",
          operation: "media",
          category: "operational",
        });
        expect(JSON.stringify(log.mock.calls)).not.toContain("private path");
      }

      await expect(deleteMedia("asset", actor)).rejects.toBeInstanceOf(
        ContentNotFoundError,
      );
      log.mockRestore();
    },
  );

  it.each(["page", "revision"])(
    "blocks a %s reference without removing metadata or bytes",
    async (reference) => {
      (reference === "page"
        ? tx.page.count
        : tx.pageRevision.count
      ).mockResolvedValue(1);
      await expect(deleteMedia("asset", actor)).rejects.toBeInstanceOf(
        MediaReferencedError,
      );
      expect(tx.media.delete).not.toHaveBeenCalled();
      expect(storage.remove).not.toHaveBeenCalled();
    },
  );

  it("rejects subscribers before the transaction and other authors before deletion", async () => {
    await expect(
      deleteMedia("asset", { id: "subscriber", role: "SUBSCRIBER" }),
    ).rejects.toBeInstanceOf(ContentForbiddenError);
    expect(db.$transaction).not.toHaveBeenCalled();
    await expect(
      deleteMedia("asset", { id: "other", role: "AUTHOR" }),
    ).rejects.toBeInstanceOf(ContentForbiddenError);
    expect(tx.media.delete).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });
});
