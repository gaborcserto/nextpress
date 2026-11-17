import { prisma } from "@nextpress/db/src/client";
import { describe, expect, it, vi } from "vitest";

import { saveDisposableWorkingAggregate } from "./working-aggregate-persistence";

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));

describe("private persistence activation boundary", () => {
  it("refuses runtime activation before touching a database", async () => {
    vi.stubEnv("NODE_ENV", "production");

    try {
      await expect(
        saveDisposableWorkingAggregate(
          prisma,
          {
            pageId: "page",
            requestId: "fab813d9-0908-4047-bb00-120c3ca232e0",
            expectedDraftVersion: 0,
            edit: {},
          },
          { id: "admin", role: "ADMIN" },
        ),
      ).rejects.toThrow("WORKING_PERSISTENCE_NOT_ACTIVATED");
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
