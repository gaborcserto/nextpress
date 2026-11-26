import { prisma } from "@nextpress/db/src/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyBackfillDatabase } from "./legacy-backfill/legacy-backfill-identity.server";
import {
  PrivateDraftUnavailableError,
  requirePrivateDraftAdmission,
} from "./private-draft-admission.server";

vi.mock("@nextpress/db/src/client", () => ({ prisma: { $queryRaw: vi.fn() } }));
vi.mock("./legacy-backfill/legacy-backfill-identity.server", () => ({
  verifyBackfillDatabase: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("private draft rehearsal admission", () => {
  it.each(["production", "", "staging"])(
    "refuses %s even with an explicit rehearsal flag",
    async (environment) => {
      vi.stubEnv("NODE_ENV", environment);
      vi.stubEnv("NEXTPRESS_PRIVATE_DRAFT_REHEARSAL", "enabled");
      await expect(requirePrivateDraftAdmission(prisma)).rejects.toBeInstanceOf(
        PrivateDraftUnavailableError,
      );
      expect(verifyBackfillDatabase).not.toHaveBeenCalled();
    },
  );

  it("defaults off in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTPRESS_PRIVATE_DRAFT_REHEARSAL", "");
    await expect(requirePrivateDraftAdmission(prisma)).rejects.toBeInstanceOf(
      PrivateDraftUnavailableError,
    );
    expect(verifyBackfillDatabase).not.toHaveBeenCalled();
  });

  it("requires independent connected database identity on every admission", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTPRESS_PRIVATE_DRAFT_REHEARSAL", "enabled");
    vi.mocked(verifyBackfillDatabase).mockResolvedValueOnce(undefined);
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ ready: true }]);
    await expect(requirePrivateDraftAdmission(prisma)).resolves.toBeUndefined();
    vi.mocked(verifyBackfillDatabase).mockRejectedValueOnce(
      new Error("secret"),
    );
    await expect(requirePrivateDraftAdmission(prisma)).rejects.toBeInstanceOf(
      PrivateDraftUnavailableError,
    );
    expect(verifyBackfillDatabase).toHaveBeenCalledTimes(2);
  });

  it("refuses missing grants or a role capable of altering protected tables", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXTPRESS_PRIVATE_DRAFT_REHEARSAL", "enabled");
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ ready: false }]);
    await expect(requirePrivateDraftAdmission(prisma)).rejects.toBeInstanceOf(
      PrivateDraftUnavailableError,
    );
  });
});
