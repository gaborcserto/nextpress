import { describe, expect, it, vi } from "vitest";

import { developmentPages, developmentTaxonomies } from "../prisma/development-content";

const { prisma } = vi.hoisted(() => ({
  prisma: {
    taxonomy: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), upsert: vi.fn() },
    page: { findUnique: vi.fn(), upsert: vi.fn() },
    pageOnTaxonomy: { upsert: vi.fn() },
    $disconnect: vi.fn(),
  },
}));
vi.mock("./client", () => ({ prisma }));
vi.mock("./development-seed-policy", () => ({ assertDevelopmentSeedAllowed: vi.fn() }));
vi.mock("dotenv/config", () => ({}));

describe("development seed persistence", () => {
  it("fills missing tags and links on reruns without overwriting existing content or associations", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    prisma.taxonomy.findUnique.mockResolvedValue(null);
    prisma.page.findUnique.mockResolvedValue(null);
    prisma.taxonomy.findUniqueOrThrow.mockImplementation(async ({ where }: { where: { slug: string } }) => {
      const taxonomy = developmentTaxonomies.find(({ slug }) => slug === where.slug);
      if (!taxonomy) throw new Error("Unknown fixture tag");
      return { id: taxonomy.id };
    });

    try {
      for (let run = 0; run < 2; run++) {
        vi.resetModules();
        await import("../prisma/seed");
        await vi.waitFor(() => expect(prisma.$disconnect).toHaveBeenCalledTimes(run + 1));
      }

      expect(prisma.taxonomy.upsert).toHaveBeenCalledTimes(developmentTaxonomies.length * 2);
      for (const taxonomy of developmentTaxonomies) {
        expect(prisma.taxonomy.upsert).toHaveBeenCalledWith({
          where: { id: taxonomy.id }, create: taxonomy, update: {},
        });
      }
      for (const page of developmentPages) {
        expect(prisma.page.upsert).toHaveBeenCalledWith(expect.objectContaining({
          where: { id: page.id }, update: {},
        }));
        for (const slug of page.taxonomies) {
          const taxonomy = developmentTaxonomies.find((tag) => tag.slug === slug);
          expect(taxonomy).toBeDefined();
          const link = { pageId: page.id, taxonomyId: taxonomy?.id };
          expect(prisma.pageOnTaxonomy.upsert).toHaveBeenCalledWith({
            where: { pageId_taxonomyId: link }, create: link, update: {},
          });
        }
      }
      const associationCount = developmentPages.reduce((count, page) => count + page.taxonomies.length, 0);
      expect(prisma.pageOnTaxonomy.upsert).toHaveBeenCalledTimes(associationCount * 2);
    } finally {
      log.mockRestore();
    }
  });
});
