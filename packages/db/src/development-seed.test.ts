import { describe, expect, it, vi } from "vitest";

import {
  developmentPages,
  developmentTaxonomies,
} from "../prisma/development-content";

const { prisma, assertDevelopmentSeedAllowed } = vi.hoisted(() => ({
  assertDevelopmentSeedAllowed: vi.fn(),
  prisma: {
    taxonomy: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      upsert: vi.fn(),
    },
    page: { findUnique: vi.fn(), upsert: vi.fn() },
    pageOnTaxonomy: { upsert: vi.fn() },
    $disconnect: vi.fn(),
  },
}));
vi.mock("./client", () => ({ prisma }));
vi.mock("./development-seed-policy", () => ({
  assertDevelopmentSeedAllowed,
}));
vi.mock("./api-environment", () => ({
  loadApiEnvironment() {
    vi.stubEnv("DATABASE_URL", "postgresql://fixture:fixture@localhost/cms");
  },
}));
vi.mock("dotenv", () => ({
  config({ processEnv }: { processEnv: NodeJS.ProcessEnv }) {
    processEnv.DATABASE_URL =
      "postgresql://fixture:fixture@localhost:55434/nextpress_dev_editorial";
    processEnv.ALLOW_DEVELOPMENT_CONTENT_SEED = "true";
  },
}));

describe("development seed persistence", () => {
  it("fills missing tags and links on reruns without overwriting existing content or associations", async () => {
    const originalExitCode = process.exitCode;
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ALLOW_DEVELOPMENT_CONTENT_SEED", undefined);
    prisma.taxonomy.findUnique.mockResolvedValue(null);
    prisma.page.findUnique.mockResolvedValue(null);
    prisma.taxonomy.findUniqueOrThrow.mockImplementation(
      async ({ where }: { where: { slug: string } }) => {
        const taxonomy = developmentTaxonomies.find(
          ({ slug }) => slug === where.slug,
        );

        if (!taxonomy) {
          throw new Error("Unknown fixture tag");
        }

        return { id: taxonomy.id };
      },
    );

    try {
      for (let run = 0; run < 2; run++) {
        // Both CLI outcomes are reported after the seed work and disconnect.
        const seedResult = new Promise<string>((resolve, reject) => {
          log.mockImplementationOnce((message: string) => resolve(message));
          error.mockImplementation((message: string) =>
            reject(new Error(message)),
          );
        });

        vi.resetModules();
        const [, message] = await Promise.all([
          import("../prisma/seed"),
          seedResult,
        ]);

        expect(message).toMatch(/^Seed OK:/);
        expect(prisma.$disconnect).toHaveBeenCalledTimes(run + 1);
      }

      expect(prisma.taxonomy.upsert).toHaveBeenCalledTimes(
        developmentTaxonomies.length * 2,
      );

      expect(assertDevelopmentSeedAllowed).toHaveBeenCalledWith(
        expect.objectContaining({
          DATABASE_URL: "postgresql://fixture:fixture@localhost:5432/cms",
          ALLOW_DEVELOPMENT_CONTENT_SEED: "true",
        }),
      );

      for (const taxonomy of developmentTaxonomies) {
        expect(prisma.taxonomy.upsert).toHaveBeenCalledWith({
          where: { id: taxonomy.id },
          create: taxonomy,
          update: {},
        });
      }

      for (const page of developmentPages) {
        expect(prisma.page.upsert).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: page.id },
            update: {},
          }),
        );

        for (const slug of page.taxonomies) {
          const taxonomy = developmentTaxonomies.find(
            (tag) => tag.slug === slug,
          );
          expect(taxonomy).toBeDefined();
          const link = { pageId: page.id, taxonomyId: taxonomy?.id };
          expect(prisma.pageOnTaxonomy.upsert).toHaveBeenCalledWith({
            where: { pageId_taxonomyId: link },
            create: link,
            update: {},
          });
        }
      }

      const associationCount = developmentPages.reduce(
        (count, page) => count + page.taxonomies.length,
        0,
      );
      expect(prisma.pageOnTaxonomy.upsert).toHaveBeenCalledTimes(
        associationCount * 2,
      );
    } finally {
      log.mockRestore();
      error.mockRestore();
      vi.unstubAllEnvs();
      process.exitCode = originalExitCode;
    }
  });
});
