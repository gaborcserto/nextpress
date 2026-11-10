// @vitest-environment node
import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const testUrl = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let create: typeof import("./pageRepo").createPageWithTags;
let update: typeof import("./pageRepo").updatePageWithTags;
const suffix = randomUUID();
const slug = `transaction-${suffix}`;
const actor = { id: "unused", role: "ADMIN" as const };
describe.skipIf(!testUrl)("isolated content aggregate transactions", () => {
  beforeAll(async () => {
    const url = new URL(testUrl ?? "");

    if (
      testUrl !== process.env.DATABASE_URL ||
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.startsWith("/nextpress_phase1_verify")
    )
      throw new Error(
        "Use matching URLs for a disposable local nextpress_phase1_verify* database only",
      );
    db = (await import("@nextpress/db/src/client")).prisma;
    ({ createPageWithTags: create, updatePageWithTags: update } =
      await import("./pageRepo"));
  });
  afterAll(async () => {
    if (!db) return;
    await db.$executeRaw`DROP TRIGGER IF EXISTS phase1_fail_links ON "PageOnTaxonomy"`;
    await db.$executeRaw`DROP FUNCTION IF EXISTS phase1_fail_links()`;
    await db.page.deleteMany({ where: { slug: { startsWith: slug } } });
    await db.taxonomy.deleteMany({ where: { slug: { startsWith: slug } } });
    await db.$disconnect();
  });
  it.each(["PAGE", "POST"] as const)(
    "%s commits links and rolls back create/update after link failure",
    async (type) => {
      const slug = `transaction-${suffix}-${type.toLowerCase()}`;
      const tag = await db.taxonomy.create({
        data: { type: "TAG", slug, name: "Tag" },
      });
      const category = await db.taxonomy.create({
        data: { type: "CATEGORY", slug: `${slug}-category`, name: "Category" },
      });
      const input = {
        type,
        status: "DRAFT" as const,
        title: "Before",
        slug,
        excerpt: "",
        content: "",
        authorId: "",
      };
      const user = await db.user.create({
        data: { email: `${slug}@example.invalid`, name: "Transaction test" },
      });
      input.authorId = user.id;
      try {
        const page = await create(input, [tag.id]);
        expect(
          ContentRecordSchema.safeParse(JSON.parse(JSON.stringify(page)))
            .success,
        ).toBe(true);
        await db.pageOnTaxonomy.create({
          data: { pageId: page.id, taxonomyId: category.id },
        });
        await update(
          page.id,
          { title: "Committed", expectedVersion: 0 },
          type,
          actor,
          [],
        );
        expect(
          await db.pageOnTaxonomy.findMany({ where: { pageId: page.id } }),
        ).toEqual([{ pageId: page.id, taxonomyId: category.id }]);
        await expect(
          update(
            page.id,
            { title: "Invalid", expectedVersion: 1 },
            type,
            actor,
            [category.id],
          ),
        ).rejects.toThrow("Invalid tag IDs");
        await expect(
          create({ ...input, slug: `${slug}-invalid` }, ["missing"]),
        ).rejects.toThrow("Invalid tag IDs");
        await db.$executeRaw`CREATE FUNCTION phase1_fail_links() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''injected link failure''; END'`;
        await db.$executeRaw`CREATE TRIGGER phase1_fail_links BEFORE INSERT ON "PageOnTaxonomy" FOR EACH ROW EXECUTE FUNCTION phase1_fail_links()`;
        try {
          await expect(
            update(
              page.id,
              { title: "Should roll back", expectedVersion: 1 },
              type,
              actor,
              [tag.id],
            ),
          ).rejects.toThrow();
          await expect(
            create({ ...input, slug: `${slug}-failed` }, [tag.id]),
          ).rejects.toThrow();
        } finally {
          await db.$executeRaw`DROP TRIGGER phase1_fail_links ON "PageOnTaxonomy"`;
          await db.$executeRaw`DROP FUNCTION phase1_fail_links()`;
        }
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: page.id } })).title,
        ).toBe("Committed");
        expect(
          await db.page.count({
            where: { slug: { in: [`${slug}-failed`, `${slug}-invalid`] } },
          }),
        ).toBe(0);
        expect(
          await db.pageOnTaxonomy.findMany({ where: { pageId: page.id } }),
        ).toEqual([{ pageId: page.id, taxonomyId: category.id }]);
        await expect(create(input, [tag.id])).rejects.toThrow(
          "Slug already exists",
        );
        await update(
          page.id,
          { title: "With tags", expectedVersion: 1 },
          type,
          actor,
          [tag.id],
        );
        await update(
          page.id,
          { title: "Tags retained", expectedVersion: 2 },
          type,
          actor,
        );
        expect(
          await db.pageOnTaxonomy.count({ where: { pageId: page.id } }),
        ).toBe(2);
      } finally {
        await db.page.deleteMany({ where: { slug: { startsWith: slug } } });
        await db.user.delete({ where: { id: user.id } });
      }
    },
  );
});
