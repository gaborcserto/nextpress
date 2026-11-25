// @vitest-environment node

import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { MediaBrowseSchema } from "@nextpress/shared/media";
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
    await db.media.deleteMany({ where: { id: { startsWith: slug } } });
    await db.taxonomy.deleteMany({ where: { slug: { startsWith: slug } } });
    await db.$disconnect();
  });

  it("commits a menu reorder once and projects only published destinations", async () => {
    const { saveMenu, deleteMenu, MenuConflictError, listMenus } =
      await import("./navigation");
    const { getPublicMenus } = await import("@/lib/public/menus.server");

    const parent = await db.page.create({
      data: {
        type: "PAGE",
        title: "Company",
        slug: `${slug}-company`,
        content: "",
        status: "PUBLISHED",
        publishedAt: new Date("2025-01-01"),
      },
    });

    const child = await db.page.create({
      data: {
        type: "PAGE",
        title: "Team",
        slug: `${slug}-team`,
        content: "",
        parentId: parent.id,
        status: "PUBLISHED",
        publishedAt: new Date("2025-01-01"),
      },
    });

    const linked = {
      id: "team",
      kind: "content" as const,
      value: child.id,
      label: "",
      parentId: null,
      newTab: false,
    };
    const external = {
      id: "external",
      kind: "external" as const,
      value: "https://example.com",
      label: "External",
      parentId: null,
      newTab: true,
    };
    const input = {
      name: "Test sidebar",
      locations: ["sidebar" as const],
      items: [linked, external],
    };
    const { id } = await saveMenu(input);

    try {
      const results = await Promise.allSettled([
        saveMenu({ ...input, items: [external, linked] }, { id, version: 0 }),
        saveMenu({ ...input, name: "Another reorder" }, { id, version: 0 }),
      ]);

      expect(
        results.filter(({ status }) => status === "fulfilled"),
      ).toHaveLength(1);
      expect(results.find(({ status }) => status === "rejected")).toMatchObject(
        {
          reason: expect.any(MenuConflictError),
        },
      );
      expect((await getPublicMenus()).sidebar).toContainEqual({
        href: `/${parent.slug}/${child.slug}`,
        label: "Team",
        parent: null,
        newTab: false,
      });

      await db.page.update({
        where: { id: parent.id },
        data: { slug: `${slug}-renamed` },
      });
      expect((await getPublicMenus()).sidebar).toContainEqual({
        href: `/${slug}-renamed/${child.slug}`,
        label: "Team",
        parent: null,
        newTab: false,
      });

      await db.page.update({
        where: { id: parent.id },
        data: { status: "DRAFT" },
      });
      expect((await getPublicMenus()).sidebar).toEqual([
        {
          href: external.value,
          label: external.label,
          newTab: true,
          parent: null,
        },
      ]);
      await db.page.delete({ where: { id: child.id } });
      expect((await getPublicMenus()).sidebar).toHaveLength(1);
    } finally {
      const saved = (await listMenus()).find((menu) => menu.id === id);

      if (saved) {
        await deleteMenu(saved.id, saved.version);
      }

      await db.page.deleteMany({
        where: { id: { in: [child.id, parent.id] } },
      });
    }
  });

  it("serializes gallery assignment against asset deletion", async () => {
    const { deleteMedia, MediaReferencedError } =
      await import("@/lib/services/media.server");
    const { MediaSelectionError } = await import("./pageRepo");

    const asset = await db.media.create({
      data: {
        id: `${slug}-race-asset`,
        url: `/media/${slug}-race-asset`,
        mime: "image/png",
      },
    });

    const page = await db.page.create({
      data: {
        type: "PAGE",
        layout: "GALLERY",
        title: "Gallery race",
        slug: `${slug}-gallery-race`,
        content: "",
      },
    });

    const [assignment, deletion] = await Promise.allSettled([
      update(
        page.id,
        { expectedVersion: 0, galleryIds: [asset.id] },
        "PAGE",
        actor,
      ),
      deleteMedia(asset.id, actor),
    ]);

    const references = await db.pageMedia.findMany({
      where: { pageId: page.id },
    });

    const retained = await db.media.findUnique({ where: { id: asset.id } });

    if (assignment.status === "fulfilled") {
      expect(deletion).toMatchObject({
        status: "rejected",
        reason: expect.any(MediaReferencedError),
      });
      expect(references).toMatchObject([{ mediaId: asset.id, sort: 0 }]);
      expect(retained).not.toBeNull();
    } else {
      expect(assignment.reason).toBeInstanceOf(MediaSelectionError);
      expect(deletion.status).toBe("fulfilled");
      expect(references).toEqual([]);
      expect(retained).toBeNull();
    }
  });

  it("scopes media browsing and metadata writes to the owning author with stable pagination", async () => {
    const { browseMedia, editMedia } =
      await import("@/lib/services/media-library.server");
    const owner = await db.user.create({ data: { name: "Media test owner" } });
    const author = { id: owner.id, role: "AUTHOR" as const };
    const created = new Date("2025-01-01T00:00:00Z");
    const assets = Array.from({ length: 25 }, (_, index) => {
      const number = String(index).padStart(2, "0");

      return {
        id: `${slug}-browse-${number}`,
        url: `/media/${slug}-browse-${number}`,
        filename: `Árvíz ${number}.jpg`,
        mime: "image/png",
        originalMime: "image/jpeg",
        uploadedById: owner.id,
        createdAt: created,
      };
    });
    const hidden = { ...assets[0], id: `${slug}-hidden`, uploadedById: null };
    await db.media.createMany({ data: [...assets, hidden] });

    try {
      const filters = {
        q: "Árvíz",
        mime: "image/jpeg",
        sort: "createdAt",
        direction: "desc",
      };
      const first = await browseMedia(MediaBrowseSchema.parse(filters), author);

      const last = await browseMedia(
        MediaBrowseSchema.parse({ ...filters, page: 2 }),
        author,
      );
      expect(first.items.map(({ id }) => id)).toEqual(
        assets.slice(0, 24).map(({ id }) => id),
      );
      expect(first.hasMore).toBe(true);
      expect(last).toMatchObject({
        items: [{ id: assets[24].id }],
        hasMore: false,
      });

      const metadata = {
        alt: "",
        caption: "Őszi kép",
        description: "Kísérleti leírás",
      };
      await expect(editMedia(hidden.id, metadata, author)).rejects.toThrow();
      await editMedia(assets[0].id, metadata, author);
      const matches = await browseMedia(
        MediaBrowseSchema.parse({ q: "Őszi" }),
        author,
      );
      expect(matches.items).toMatchObject([{ ...metadata, id: assets[0].id }]);
    } finally {
      await db.media.deleteMany({
        where: { id: { in: [...assets, hidden].map(({ id }) => id) } },
      });
      await db.user.delete({ where: { id: owner.id } });
    }
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

  it("searches and filters across posts before applying deterministic pagination", async () => {
    const { listPages } = await import("./pageRepo");

    const tag = await db.taxonomy.create({
      data: { slug: slug + "-discovery-tag", name: "Discovery", type: "TAG" },
    });

    const category = await db.taxonomy.create({
      data: {
        slug: slug + "-discovery-category",
        name: "News",
        type: "CATEGORY",
      },
    });

    const candidates = await db.page.createManyAndReturn({
      data: ["alpha", "beta", "excluded"].map((name) => ({
        type: "POST",
        slug: slug + "-discovery-" + name,
        title: "Discovery tie",
        content: "",
        status: "PUBLISHED",
        publishedAt: new Date("2099-01-01"),
      })),
    });

    const matching = candidates.filter(
      ({ slug }) => !slug.endsWith("excluded"),
    );
    await db.pageOnTaxonomy.createMany({
      data: matching.flatMap(({ id }) => [
        { pageId: id, taxonomyId: tag.id },
        { pageId: id, taxonomyId: category.id },
      ]),
    });
    const filters = {
      q: (slug + "-DISCOVERY").toUpperCase(),
      status: "SCHEDULED",
      tag: tag.slug,
      category: category.slug,
      sort: "title",
      direction: "asc",
    } as const;

    const first = await listPages(0, 1, { type: "POST", actor, filters });
    const second = await listPages(1, 1, { type: "POST", actor, filters });
    const unauthenticated = await listPages(0, 1, { type: "POST", filters });

    expect(first.total).toBe(2);
    expect(second.total).toBe(2);
    expect([...first.items, ...second.items].map(({ id }) => id)).toEqual(
      matching.map(({ id }) => id).sort(),
    );
    expect(first.items[0]).toMatchObject({
      publicationState: "SCHEDULED",
      publishedAt: new Date("2099-01-01"),
      createdAt: expect.any(Date),
      updatedAt: expect.any(Date),
    });
    expect(unauthenticated).toEqual({ items: [], total: 0 });
  });

  it("matches page types as displayed and reverses date sorting", async () => {
    const { listPages } = await import("./pageRepo");
    const entries = [
      {
        kind: "gallery-old",
        layout: "GALLERY",
        createdAt: new Date("2020-01-01"),
      },
      {
        kind: "gallery-new",
        layout: "GALLERY",
        createdAt: new Date("2021-01-01"),
      },
      { kind: "legacy", layout: "CONTACT", createdAt: new Date("2022-01-01") },
    ] as const;
    await db.page.createMany({
      data: entries.map(({ kind, ...fields }) => ({
        ...fields,
        type: "PAGE",
        slug: slug + "-layouts-" + kind,
        title: kind,
        content: "",
      })),
    });
    const match = {
      q: slug + "-layouts",
      status: "DRAFT",
      sort: "createdAt",
    } as const;

    const oldest = await listPages(0, 1, {
      actor,
      filters: { ...match, pageType: "gallery", direction: "asc" },
    });

    const newest = await listPages(0, 1, {
      actor,
      filters: { ...match, pageType: "gallery", direction: "desc" },
    });

    const standard = await listPages(0, 10, {
      actor,
      filters: { ...match, pageType: "standard" },
    });

    expect(oldest.total).toBe(2);
    expect(oldest.items[0]?.title).toBe("gallery-old");
    expect(newest.items[0]?.title).toBe("gallery-new");
    expect(standard.items.map(({ title }) => title)).toEqual(["legacy"]);
  });

  it("sorts taxonomy by post usage while excluding page links from the count", async () => {
    const { listTaxonomyPage } = await import("./tagRepo");

    const a = await db.taxonomy.create({
      data: { slug: slug + "-usage-low", name: "Low use", type: "CATEGORY" },
    });

    const b = await db.taxonomy.create({
      data: { slug: slug + "-usage-high", name: "High use", type: "CATEGORY" },
    });

    const page = await db.page.create({
      data: {
        slug: slug + "-usage-page",
        title: "Page",
        type: "PAGE",
        content: "",
      },
    });

    const post = await db.page.create({
      data: {
        slug: slug + "-usage-post",
        title: "Post",
        type: "POST",
        content: "",
      },
    });
    await db.pageOnTaxonomy.createMany({
      data: [
        { pageId: page.id, taxonomyId: a.id },
        { pageId: post.id, taxonomyId: b.id },
      ],
    });
    const filters = {
      type: "CATEGORY",
      q: slug + "-USAGE",
      sort: "usedCount",
      direction: "desc",
    } as const;

    const first = await listTaxonomyPage(filters, 1, 1);
    const second = await listTaxonomyPage(filters, 2, 1);
    const beyond = await listTaxonomyPage(filters, 3, 1);

    expect(first).toMatchObject({
      items: [{ id: b.id, usedCount: 1 }],
      total: 2,
      pages: 2,
    });
    expect(second.items).toMatchObject([{ id: a.id, usedCount: 0 }]);
    expect(beyond).toMatchObject({ items: [], page: 3, total: 2, pages: 2 });
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
          { id: user.id, role: "ADMIN" },
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
        const page = await create(input, [tag.id], actor);
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
          create({ ...input, slug: `${slug}-invalid` }, ["missing"], actor),
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
            create({ ...input, slug: `${slug}-failed` }, [tag.id], actor),
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
        await expect(create(input, [tag.id], actor)).rejects.toThrow(
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

  it("synchronizes Header Page nesting in the menu save transaction", async () => {
    const { saveMenu } = await import("./navigation");

    const headerAssignment = await db.navigationAssignment.findUniqueOrThrow({
      where: { location: "header" },
      select: {
        menu: {
          select: {
            id: true,
            name: true,
            version: true,
            items: true,
          },
        },
      },
    });

    const parent = await db.page.create({
      data: {
        type: "PAGE",
        title: "Header parent",
        slug: `${slug}-header-parent`,
        content: "",
        status: "DRAFT",
      },
    });

    const child = await db.page.create({
      data: {
        type: "PAGE",
        title: "Header child",
        slug: `${slug}-header-child`,
        content: "",
        status: "DRAFT",
      },
    });

    try {
      const menu = await saveMenu(
        {
          name: "Header hierarchy test",
          locations: ["header"],
          items: [
            {
              id: "parent",
              parentId: null,
              kind: "content",
              label: "",
              value: parent.id,
              newTab: false,
            },
            {
              id: "child",
              parentId: "parent",
              kind: "content",
              label: "",
              value: child.id,
              newTab: false,
            },
          ],
        },
        {
          id: headerAssignment.menu.id,
          version: headerAssignment.menu.version,
        },
      );

      expect(
        await db.navigationItem.findUniqueOrThrow({
          where: { menuId_id: { menuId: menu.id, id: "child" } },
          select: { parentId: true },
        }),
      ).toEqual({ parentId: "parent" });
      expect(menu.id).toBe(headerAssignment.menu.id);
    } finally {
      const currentMenu = await db.navigationMenu.findUniqueOrThrow({
        where: { id: headerAssignment.menu.id },
        select: { version: true },
      });
      await saveMenu(
        {
          name: headerAssignment.menu.name,
          locations: ["header"],
          items: headerAssignment.menu.items.map(
            ({ id, parentId, kind, label, value, newTab, visible }) => ({
              id,
              parentId,
              kind,
              label,
              value,
              newTab,
              visible,
            }),
          ),
        },
        { id: headerAssignment.menu.id, version: currentMenu.version },
      );
      await db.page.deleteMany({
        where: { id: { in: [parent.id, child.id] } },
      });
    }
  });
});
