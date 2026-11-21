import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { mediaStorage } from "./media-storage.server";

let root: string;
const key = "e5ec1005-0000-4000-8000-000000000001.png";

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "nextpress-media-test-"));
  vi.stubEnv("MEDIA_STORAGE_ROOT", root);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});

it("reads existing PNG keys and refuses to overwrite their bytes", async () => {
  const original = Buffer.from([1, 2, 3]);
  await mediaStorage.put(key, original);

  await expect(mediaStorage.put(key, Buffer.from([4]))).rejects.toMatchObject({
    code: "EEXIST",
  });
  await expect(mediaStorage.read(key)).resolves.toEqual(original);
});

it("rejects keys outside the storage root", async () => {
  await expect(
    mediaStorage.put("../outside.png", Buffer.from([1])),
  ).rejects.toThrow("Invalid storage key");
  expect(() => mediaStorage.read("../outside.png")).toThrow(
    "Invalid storage key",
  );
  expect(() => mediaStorage.remove("../outside.png")).toThrow(
    "Invalid storage key",
  );
});

it("reports a missing file after removing an owned object", async () => {
  await mediaStorage.put(key, Buffer.from([1]));
  await mediaStorage.remove(key);

  await expect(mediaStorage.read(key)).rejects.toMatchObject({
    code: "ENOENT",
  });
});
