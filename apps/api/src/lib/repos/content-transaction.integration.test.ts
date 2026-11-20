// @vitest-environment node

import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disposableDatabaseName } from "../testing/disposable-database";
import { verifyDisposableDatabase } from "../testing/docker-database";

const testUrl = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
let db: typeof import("@nextpress/db/src/client").prisma;
let create: typeof import("./pageRepo").createPageWithTags;
let update: typeof import("./pageRepo").updatePageWithTags;
const suffix = randomUUID();
const slug = `transaction-${suffix}`;
const actor = { id: "unused", role: "ADMIN" as const };
describe.skipIf(!testUrl)("isolated content aggregate transactions", () => {
  beforeAll(async () => {
    const expectedName = disposableDatabaseName(
      testUrl,
      process.env.DATABASE_URL,
      "content",
    );
    const candidate = (await import("@nextpress/db/src/client")).prisma;
    await verifyDisposableDatabase(expectedName, candidate);
    db = candidate;
    ({ createPageWithTags: create, updatePageWithTags: update } =
      await import("./pageRepo"));
  });
  afterAll(async () => {
    if (!db) {
      return;
    }

    await verifyDisposableDatabase(
      disposableDatabaseName(testUrl, process.env.DATABASE_URL, "content"),
      db,
    );
    await db.$executeRaw`DROP TRIGGER IF EXISTS phase1_fail_links ON "PageOnTaxonomy"`;
    await db.$executeRaw`DROP FUNCTION IF EXISTS phase1_fail_links()`;
    await db.page.deleteMany({ where: { slug: { startsWith: slug } } });
    await db.taxonomy.deleteMany({ where: { slug: { startsWith: slug } } });
    await db.$disconnect();
  });
  it("excludes drafts, missing dates and future schedules from anonymous endpoints", async () => {
    const { GET: contentIndex } =
      await import("@/app/api/public/content/route");
    const { GET: navigation } =
      await import("@/app/api/public/navigation/route");
    const { GET: publicPage } =
      await import("@/app/api/public/pages/[slug]/route");
    const { GET: publicPost } =
      await import("@/app/api/public/posts/[slug]/route");
    const { GET: posts } = await import("@/app/api/public/posts/route");
    const { GET: search } = await import("@/app/api/public/search/route");
    const { GET: tags } = await import("@/app/api/public/tags/route");
    const { GET: taxonomyPosts } =
      await import("@/app/api/public/taxonomies/[type]/[slug]/route");

    const states = [
      { name: "draft", status: "DRAFT", publishedAt: new Date("2020-01-01") },
      { name: "missing", status: "PUBLISHED", publishedAt: null },
      {
        name: "future",
        status: "PUBLISHED",
        publishedAt: new Date("2099-01-01"),
      },
      {
        name: "live",
        status: "PUBLISHED",
        publishedAt: new Date("2020-01-01"),
      },
    ] as const;

    for (const { name, status, publishedAt } of states) {
      const tag = await db.taxonomy.create({
        data: { slug: `${slug}-${name}`, name, type: "TAG" },
      });

      await db.page.createMany({
        data: (["PAGE", "POST"] as const).map((type) => ({
          type,
          status,
          publishedAt,
          slug: `${slug}-${name}-${type.toLowerCase()}`,
          title: slug,
          content: "",
          inHeaderMenu: true,
        })),
      });

      const post = await db.page.findUniqueOrThrow({
        where: { slug: `${slug}-${name}-post` },
      });
      await db.pageOnTaxonomy.create({
        data: { pageId: post.id, taxonomyId: tag.id },
      });

      const expectedStatus = name === "live" ? 200 : 404;

      const pageResponse = await publicPage(
        new Request("http://localhost/api/public/pages"),
        {
          params: Promise.resolve({ slug: `${slug}-${name}-page` }),
        },
      );

      const postResponse = await publicPost(
        new Request("http://localhost/api/public/posts"),
        {
          params: Promise.resolve({ slug: post.slug }),
        },
      );

      expect(pageResponse.status, name).toBe(expectedStatus);
      expect(postResponse.status, name).toBe(expectedStatus);
    }

    const livePage = { slug: `${slug}-live-page` };
    const livePost = { slug: `${slug}-live-post` };
    const liveTag = { slug: `${slug}-live` };
    const response = await search(
      new Request(`http://localhost/api/public/search?q=${slug}`),
    );

    expect(await response.json()).toMatchObject({
      total: 2,
      results: [livePage, livePost],
      taxonomies: [liveTag],
    });

    const menu = await navigation(
      new Request("http://localhost/api/public/navigation"),
    );
    expect(await menu.json()).toMatchObject({ header: [livePage] });

    const index = await contentIndex(
      new Request("http://localhost/api/public/content?kind=PAGE"),
    );
    expect(await index.json()).toMatchObject({ items: [livePage] });

    const archive = await posts(
      new Request("http://localhost/api/public/posts"),
    );
    expect(await archive.json()).toMatchObject({ posts: [livePost] });

    const tagList = await tags(new Request("http://localhost/api/public/tags"));
    expect(await tagList.json()).toMatchObject({ tags: [liveTag] });

    const hiddenTag = await taxonomyPosts(
      new Request("http://localhost/api/public/taxonomies"),
      {
        params: Promise.resolve({ type: "TAG", slug: `${slug}-future` }),
      },
    );

    expect(await hiddenTag.json()).toMatchObject({ posts: [] });
  });

  it.each(["PAGE", "POST"] as const)(
    "%s retains historical missing publication dates on ordinary updates",
    async (type) => {
      const historical = await db.page.create({
        data: {
          type,
          status: "PUBLISHED",
          slug: `${slug}-legacy-${type.toLowerCase()}`,
          title: "Historical record",
          content: "",
        },
      });

      const saved = await update(
        historical.id,
        { expectedVersion: 0, title: "Edited" },
        type,
        actor,
      );

      expect(saved).toMatchObject({
        status: "PUBLISHED",
        publishedAt: null,
        workingVersion: 1,
        title: "Edited",
      });

      const { GET: detail } =
        type === "PAGE"
          ? await import("@/app/api/public/pages/[slug]/route")
          : await import("@/app/api/public/posts/[slug]/route");

      const anonymous = await detail(
        new Request("http://localhost/api/public"),
        {
          params: Promise.resolve({ slug: historical.slug }),
        },
      );

      expect(anonymous.status).toBe(404);
    },
  );

  it.each(["PAGE", "POST"] as const)(
    "%s reloads a draft, schedule, live save and withdrawal",
    async (type) => {
      const user = await db.user.create({
        data: { name: "Lifecycle verification" },
      });
      const publishedAt = new Date("2099-01-01T00:00:00.000Z");

      try {
        const page = await create(
          {
            type,
            status: "DRAFT",
            slug: `${slug}-lifecycle-${type.toLowerCase()}`,
            title: "Draft",
            content: "",
            excerpt: "",
            authorId: user.id,
          },
          [],
        );
        expect(page.publishedAt).toBeNull();
        await update(
          page.id,
          {
            expectedVersion: 0,
            status: "PUBLISHED",
            publishedAt: publishedAt.toISOString(),
          },
          type,
          actor,
        );
        await update(
          page.id,
          { expectedVersion: 1, title: "Scheduled edit" },
          type,
          actor,
        );
        const scheduled = await db.page.findUniqueOrThrow({
          where: { id: page.id },
        });
        expect(scheduled.publishedAt).toEqual(publishedAt);
        expect(scheduled.status).toBe("PUBLISHED");
        expect(
          await db.page.count({
            where: {
              id: page.id,
              status: "PUBLISHED",
              publishedAt: { lte: new Date() },
            },
          }),
        ).toBe(0);
        await expect(
          update(
            page.id,
            { expectedVersion: 1, title: "Stale edit" },
            type,
            actor,
          ),
        ).rejects.toThrow();
        await update(
          page.id,
          { expectedVersion: 2, publishedAt: null },
          type,
          actor,
        );
        const live = await db.page.findUniqueOrThrow({
          where: { id: page.id },
        });
        expect(live.publishedAt).not.toBeNull();
        expect(
          await db.page.count({
            where: {
              id: page.id,
              status: "PUBLISHED",
              publishedAt: { lte: new Date() },
            },
          }),
        ).toBe(1);
        await update(
          page.id,
          { expectedVersion: 3, status: "DRAFT" },
          type,
          actor,
        );
        const withdrawn = await db.page.findUniqueOrThrow({
          where: { id: page.id },
        });
        expect(withdrawn.publishedAt).toEqual(live.publishedAt);
        expect(withdrawn.status).toBe("DRAFT");
        expect(withdrawn.title).toBe("Scheduled edit");
        expect(
          await db.page.count({ where: { id: page.id, status: "PUBLISHED" } }),
        ).toBe(0);
      } finally {
        await db.page.deleteMany({ where: { authorId: user.id } });
        await db.user.delete({ where: { id: user.id } });
      }
    },
  );

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
