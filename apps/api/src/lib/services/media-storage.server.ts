import "server-only";

import { mkdir, open, readFile, unlink } from "node:fs/promises";
import path from "node:path";

function storagePath(key: string) {
  if (!/^[a-f0-9-]{36}\.png$/.test(key)) {
    throw new Error("Invalid storage key");
  }

  // Runtime media is mutable private data, never a deployment-tracing input.
  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.MEDIA_STORAGE_ROOT?.trim() ||
      ".media",
  );

  if (root.split(path.sep).some((part) => part.toLowerCase() === "public")) {
    throw new Error("Media storage must be outside public directories");
  }

  return path.join(/* turbopackIgnore: true */ root, key);
}

export const mediaStorage = {
  async put(key: string, bytes: Uint8Array) {
    const destination = storagePath(key);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    const file = await open(destination, "wx", 0o600);

    try {
      try {
        await file.writeFile(bytes);
      } finally {
        await file.close();
      }
    } catch (error) {
      try {
        await unlink(destination);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          "Incomplete media write",
        );
      }

      throw error;
    }
  },
  read(key: string) {
    return readFile(/* turbopackIgnore: true */ storagePath(key));
  },
  remove(key: string) {
    return unlink(storagePath(key));
  },
};
