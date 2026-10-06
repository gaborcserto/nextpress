import { beforeEach, expect, it, vi } from "vitest";

const { findByName, findBySlug, create } = vi.hoisted(() => ({ findByName: vi.fn(), findBySlug: vi.fn(), create: vi.fn() }));
vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));
vi.mock("@/lib/repos", () => ({ findTagByNameInsensitive: findByName, findTagBySlug: findBySlug, createTagRecord: create }));

import { createTagService, ValidationError } from "./tag.server";

beforeEach(() => vi.resetAllMocks());

it("bounds collision lookups instead of querying indefinitely", async () => {
  findByName.mockResolvedValue(null);
  findBySlug.mockResolvedValue({ id: "collision" });
  await expect(createTagService("New tag")).rejects.toBeInstanceOf(ValidationError);
  expect(findBySlug).toHaveBeenCalledTimes(10);
  expect(create).not.toHaveBeenCalled();
});

it("preserves ordinary slug suffixing and existing tag reuse", async () => {
  findByName.mockResolvedValue(null);
  findBySlug.mockResolvedValueOnce({ id: "collision" }).mockResolvedValueOnce(null);
  create.mockResolvedValue({ id: "created", name: "New tag", slug: "new-tag-2" });
  await expect(createTagService("New tag")).resolves.toMatchObject({ slug: "new-tag-2" });
  expect(create).toHaveBeenCalledWith("New tag", "new-tag-2");
  findByName.mockResolvedValue({ id: "existing" });
  await expect(createTagService("New tag")).resolves.toEqual({ id: "existing" });
  expect(create).toHaveBeenCalledTimes(1);
});

it("propagates database lookup failures without attempting writes", async () => {
  findByName.mockResolvedValue(null);
  findBySlug.mockRejectedValue(new Error("Database unavailable"));
  await expect(createTagService("New tag")).rejects.toThrow("Database unavailable");
  expect(create).not.toHaveBeenCalled();
});
