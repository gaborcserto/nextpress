import { beforeEach, describe, expect, it, vi } from "vitest";

import { DELETE as deleteAdminTag } from "./admin/tags/[id]/route";
import { GET as readPage, PUT as updatePage, DELETE as deletePage } from "./pages/[id]/route";
import { GET as listPages, POST as createPage } from "./pages/route";
import { GET as readPost, PUT as updatePost, DELETE as deletePost } from "./post/[id]/route";
import { GET as listPosts, POST as createPost } from "./post/route";
import { GET as readLinks, PUT as replaceTags } from "./tags/link/route";
import { DELETE as deleteTag } from "./tags/route";
import { getAuth, getSessionWithRole } from "@/lib/auth/auth-server";
import type { RoleName } from "@/lib/auth/roles";
import type { BetterAuthOptions } from "better-auth";

const { prisma, session, configureAuth } = vi.hoisted(() => ({
  prisma: {
    page: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUniqueOrThrow: vi.fn() },
    taxonomy: { findMany: vi.fn(), delete: vi.fn() },
    pageOnTaxonomy: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
    user: { findUnique: vi.fn(), updateMany: vi.fn() },
    role: { findUniqueOrThrow: vi.fn() },
    oAuthProvider: { findMany: vi.fn() },
    siteSettings: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
  session: vi.fn(),
  configureAuth: vi.fn<(options: BetterAuthOptions) => unknown>(),
}));

vi.mock("@nextpress/db/src/client", () => ({ prisma }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("better-auth", () => ({ betterAuth: (options: BetterAuthOptions) => {
  configureAuth(options);
  return { api: { getSession: session } };
} }));
vi.mock("better-auth/adapters/prisma", () => ({ prismaAdapter: vi.fn() }));
vi.mock("better-auth/next-js", () => ({ nextCookies: vi.fn() }));

type Content = ReturnType<typeof content>;
type Filter = { id?: string; slug?: string; type?: string; status?: string; authorId?: string; OR?: Filter[] };
let records: Content[];
let role: RoleName | null;

function content(id: string, type: "PAGE" | "POST", status: "DRAFT" | "PUBLISHED", authorId = "author-1") {
  return {
    id, type, status, authorId, slug: `${id}-slug`, title: id, content: "", excerpt: "",
    updatedAt: new Date(), publishedAt: null, parentId: null, inHeaderMenu: false, inFooterMenu: false,
    listingKind: null, listingTaxonomyId: null, eventStart: null, eventEnd: null, eventLocation: null,
    registrationUrl: null, redirectTo: null,
  };
}

function matches(item: Content, where: Filter): boolean {
  const { OR, ...fields } = where;
  return Object.entries(fields).every(([key, value]) => item[key as keyof Content] === value)
    && (!OR || OR.some((condition) => matches(item, condition)));
}

function request(method = "GET", body?: unknown, query = "") {
  return new Request(`http://localhost:49101/api/test${query}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: body === undefined ? undefined : { "content-type": "application/json" },
  });
}
function context(id: string) { return { params: Promise.resolve({ id }) }; }

beforeEach(() => {
  vi.resetAllMocks();
  role = null;
  records = [content("page-draft", "PAGE", "DRAFT"), content("page-live", "PAGE", "PUBLISHED"),
    content("post-draft", "POST", "DRAFT"), content("post-live", "POST", "PUBLISHED"),
    content("other-page", "PAGE", "DRAFT", "other-author"), content("other-post", "POST", "DRAFT", "other-author")];
  session.mockImplementation(async () => role ? { user: { id: "author-1" } } : null);
  prisma.user.findUnique.mockImplementation(async () => ({ roleId: "role-id", role: { name: role } }));
  prisma.role.findUniqueOrThrow.mockResolvedValue({ id: "subscriber-role" });
  prisma.oAuthProvider.findMany.mockResolvedValue([]);
  prisma.page.findUnique.mockImplementation(async ({ where }: { where: Filter }) => records.find((item) => matches(item, where)) ?? null);
  prisma.page.findFirst.mockImplementation(async ({ where }: { where: Filter }) => records.find((item) => matches(item, where)) ?? null);
  prisma.page.findMany.mockImplementation(async ({ where }: { where: Filter }) => records.filter((item) => matches(item, where)));
  prisma.page.count.mockImplementation(async ({ where }: { where: Filter }) => records.filter((item) => matches(item, where)).length);
  prisma.page.findUniqueOrThrow.mockResolvedValue({ id: "page-draft" });
  prisma.page.update.mockImplementation(async ({ where, data }: { where: Filter; data: Partial<Content> }) => {
    const item = records.find((item) => matches(item, where));
    if (!item) throw new Error("Record not found");
    Object.assign(item, data);
    return item;
  });
  prisma.page.create.mockImplementation(async ({ data }: { data: Content }) => ({ ...data, id: "created" }));
  prisma.taxonomy.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] }; type: string } }) =>
    where.type === "TAG" && where.id.in.includes("tag-1") ? [{ id: "tag-1" }] : []);
  prisma.pageOnTaxonomy.findMany.mockResolvedValue([]);
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));
  prisma.siteSettings.findUnique.mockResolvedValue({ defaultUserRole: "ADMIN" });
});

const routes = [
  { type: "PAGE", prefix: "page", list: listPages, read: readPage, create: createPage, update: updatePage, delete: deletePage },
  { type: "POST", prefix: "post", list: listPosts, read: readPost, create: createPost, update: updatePost, delete: deletePost },
] as const;

describe.each(routes)("$type content authorization", ({ type, prefix, list, read, create, update, delete: remove }) => {
  it.each([null, "SUBSCRIBER"] as const)("lists only published content for %s", async (viewer) => {
    role = viewer;
    const response = await list(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ items: [{ id: `${prefix}-live` }], total: 1 });
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { type, status: "PUBLISHED" } }));
    expect(prisma.page.count).toHaveBeenCalledWith({ where: { type, status: "PUBLISHED" } });
  });

  it.each(["id", "slug"])("hides drafts from anonymous lookup by %s", async (lookup) => {
    const ref = `${prefix}-draft${lookup === "slug" ? "-slug" : ""}`;
    const response = await read(request(), context(ref));
    expect(response.status).toBe(404);
    expect(prisma.pageOnTaxonomy.findMany).not.toHaveBeenCalled();
    for (const [args] of prisma.page.findUnique.mock.calls) expect(args.where.status).toBe("PUBLISHED");
  });

  it.each(["id", "slug"])("keeps published lookup by %s working", async (lookup) => {
    const response = await read(request(), context(`${prefix}-live${lookup === "slug" ? "-slug" : ""}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ item: { title: `${prefix}-live` } });
    expect(prisma.pageOnTaxonomy.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { pageId: `${prefix}-live` } }));
  });

  it("limits author draft reads to their own content", async () => {
    role = "AUTHOR";
    expect((await read(request(), context(`${prefix}-draft`))).status).toBe(200);
    expect((await read(request(), context(`other-${prefix}`))).status).toBe(404);
    expect(await (await list(request())).json()).toMatchObject({ total: 2 });
  });

  it.each(["EDITOR", "ADMIN"] as const)("allows %s to read, edit, publish, and delete others' content", async (viewer) => {
    role = viewer;
    expect((await read(request(), context(`other-${prefix}`))).status).toBe(200);
    expect(await (await list(request())).json()).toMatchObject({ total: 3 });
    expect((await update(request("PUT", { title: "Edited", status: "PUBLISHED" }), context(`other-${prefix}`))).status).toBe(200);
    expect((await remove(request("DELETE"), context(`other-${prefix}`))).status).toBe(200);
    expect(prisma.page.delete).toHaveBeenCalledWith({ where: { id: `other-${prefix}`, type } });
  });

  it.each([{ title: "Stolen" }, { status: "PUBLISHED" }, { status: "DRAFT" }, { tagIds: ["tag-1"] }])("rejects author changes to another author's content: %j", async (body) => {
    role = "AUTHOR";
    expect((await update(request("PUT", body), context(`other-${prefix}`))).status).toBe(403);
    expect(prisma.page.update).not.toHaveBeenCalled();
    expect(prisma.pageOnTaxonomy.deleteMany).not.toHaveBeenCalled();
  });

  it("allows owner editing, publishing, and unpublishing without clearing omitted tags", async () => {
    role = "AUTHOR";
    for (const status of ["PUBLISHED", "DRAFT"]) {
      expect((await update(request("PUT", { title: "Own edit", status }), context(`${prefix}-draft`))).status).toBe(200);
    }
    expect(prisma.page.update).toHaveBeenCalledWith({ where: { id: `${prefix}-draft`, type, authorId: "author-1" }, data: { title: "Own edit", status: "DRAFT" } });
    expect(prisma.pageOnTaxonomy.deleteMany).not.toHaveBeenCalled();
    expect((await remove(request("DELETE"), context(`${prefix}-draft`))).status).toBe(401);
  });

  it.each([null, "SUBSCRIBER"] as const)("denies mutations to %s", async (viewer) => {
    role = viewer;
    expect((await create(request("POST", {}), context(""))).status).toBe(401);
    expect((await update(request("PUT", { title: "No" }), context(`${prefix}-live`))).status).toBe(401);
    expect((await remove(request("DELETE"), context(`${prefix}-live`))).status).toBe(401);
    expect(prisma.page.update).not.toHaveBeenCalled();
  });

  it("creates content for the authenticated author, ignoring browser ownership", async () => {
    role = "AUTHOR";
    const response = await create(request("POST", { type, status: "PUBLISHED", title: "New", slug: "new", authorId: "other-author" }), context(""));
    expect(response.status).toBe(201);
    expect(prisma.page.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: "author-1", type }) }));
  });

  it("rejects wrong record types and explicit type transitions before writes", async () => {
    role = "ADMIN";
    const otherType = type === "PAGE" ? "POST" : "PAGE";
    const otherPrefix = prefix === "page" ? "post" : "page";
    expect((await update(request("PUT", { title: "No" }), context(`${otherPrefix}-draft`))).status).toBe(404);
    expect((await update(request("PUT", { type: otherType }), context(`${prefix}-draft`))).status).toBe(400);
    expect((await remove(request("DELETE"), context(`${otherPrefix}-draft`))).status).toBe(404);
    expect((await create(request("POST", { type: otherType, status: "DRAFT", title: "No", slug: "new" }), context(""))).status).toBe(400);
    expect(prisma.page.update).not.toHaveBeenCalled();
    expect(prisma.page.delete).not.toHaveBeenCalled();
    expect(prisma.page.create).not.toHaveBeenCalled();
  });

  it("rejects category and missing tag IDs before creating or updating content", async () => {
    role = "AUTHOR";
    for (const tagId of ["category-1", "missing"]) {
      expect((await update(request("PUT", { title: "No", tagIds: [tagId] }), context(`${prefix}-draft`))).status).toBe(400);
      expect((await create(request("POST", { type, status: "DRAFT", title: "No", slug: "new", tagIds: [tagId] }), context(""))).status).toBe(400);
    }
    expect(prisma.page.update).not.toHaveBeenCalled();
    expect(prisma.page.create).not.toHaveBeenCalled();
    expect(prisma.pageOnTaxonomy.deleteMany).not.toHaveBeenCalled();
  });
});

describe("parent and taxonomy access boundaries", () => {
  it("does not enumerate drafts or posts in the public parent selector", async () => {
    const response = await listPages(request("GET", undefined, "?select=parent"));
    expect(await response.json()).toEqual([expect.objectContaining({ id: "page-live" })]);
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { type: "PAGE", status: "PUBLISHED" } }));
  });

  it("hides taxonomy associations of drafts from public readers", async () => {
    expect((await readLinks(request("GET", undefined, "?entityId=page-draft"))).status).toBe(404);
    expect(prisma.pageOnTaxonomy.findMany).not.toHaveBeenCalled();
    expect((await readLinks(request("GET", undefined, "?entityId=page-live"))).status).toBe(200);
  });

  it("rejects author relinking of someone else's content", async () => {
    role = "AUTHOR";
    expect((await replaceTags(request("PUT", { tagIds: ["tag-1"] }, "?entityId=other-page"), context(""))).status).toBe(403);
    expect(prisma.pageOnTaxonomy.deleteMany).not.toHaveBeenCalled();
  });

  it.each(["AUTHOR", "EDITOR", "ADMIN"] as const)("allows %s to link tags within content scope and preserves categories", async (viewer) => {
    role = viewer;
    expect((await replaceTags(request("PUT", { tagIds: ["tag-1"] }, "?entityId=page-draft"), context(""))).status).toBe(200);
    expect(prisma.pageOnTaxonomy.deleteMany).toHaveBeenCalledWith({ where: { pageId: "page-draft", taxonomy: { type: "TAG" } } });
    expect(prisma.pageOnTaxonomy.createMany).toHaveBeenCalledWith({ data: [{ pageId: "page-draft", taxonomyId: "tag-1" }], skipDuplicates: true });
  });

  it.each([{ ids: ["category-1"] }, { ids: ["missing"] }, { ids: ["tag-1", "category-1"] }, { ids: [5] }, { ids: "tag-1" }])("rejects invalid links before destructive writes: %j", async ({ ids }) => {
    role = "ADMIN";
    expect((await replaceTags(request("PUT", { tagIds: ids }, "?entityId=page-draft"), context(""))).status).toBe(400);
    expect(prisma.pageOnTaxonomy.deleteMany).not.toHaveBeenCalled();
    expect(prisma.pageOnTaxonomy.createMany).not.toHaveBeenCalled();
  });

  it("empty tag replacement preserves category associations", async () => {
    role = "AUTHOR";
    expect((await replaceTags(request("PUT", [], "?entityId=page-draft"), context(""))).status).toBe(200);
    expect(prisma.pageOnTaxonomy.deleteMany).toHaveBeenCalledWith({ where: { pageId: "page-draft", taxonomy: { type: "TAG" } } });
    expect(prisma.pageOnTaxonomy.createMany).not.toHaveBeenCalled();
  });

  it.each(["public", "admin"])("cannot delete CATEGORY through the %s TAG endpoint", async (endpoint) => {
    role = "ADMIN";
    prisma.taxonomy.delete.mockImplementation(async ({ where }: { where: { id: string; type: string } }) => {
      if (where.id === "category-1" && where.type === "TAG") throw { code: "P2025" };
      return { id: where.id, type: "CATEGORY" };
    });
    const response = endpoint === "public"
      ? await deleteTag(request("DELETE", undefined, "?id=category-1"), context(""))
      : await deleteAdminTag(request("DELETE"), context("category-1"));
    expect(response.status).toBe(404);
    expect(prisma.taxonomy.delete).toHaveBeenCalledWith({ where: { id: "category-1", type: "TAG" } });
  });

  it.each(["EDITOR", "ADMIN"] as const)("allows %s to delete TAG records", async (viewer) => {
    role = viewer;
    prisma.taxonomy.delete.mockResolvedValue({ id: "tag-1", type: "TAG", name: "Tag", slug: "tag" });
    expect((await deleteTag(request("DELETE", undefined, "?id=tag-1"), context(""))).status).toBe(200);
  });

  it("denies global tag deletion to authors", async () => {
    role = "AUTHOR";
    expect((await deleteTag(request("DELETE", undefined, "?id=tag-1"), context(""))).status).toBe(401);
    expect((await deleteAdminTag(request("DELETE"), context("tag-1"))).status).toBe(401);
    expect(prisma.taxonomy.delete).not.toHaveBeenCalled();
  });
});

describe("public registration roles", () => {
  it.each(["ADMIN", "EDITOR", "AUTHOR"])("forces SUBSCRIBER despite browser and administrative %s roles", async (elevated) => {
    prisma.siteSettings.findUnique.mockResolvedValue({ defaultUserRole: elevated });
    await getAuth();
    const options = configureAuth.mock.calls[0]?.[0];
    const before = options?.databaseHooks?.user?.create?.before;
    if (!before) throw new Error("Missing registration authorization hook");
    const result = await before({ id: "new", name: "New", email: "new@example.com", emailVerified: false, createdAt: new Date(), updatedAt: new Date(), role: elevated, roleId: "elevated-id" }, null);
    expect(result).toEqual({ data: { email: "new@example.com", roleId: "subscriber-role" } });
    expect(options?.user?.additionalFields?.roleId).toMatchObject({ input: false });
    expect(prisma.role.findUniqueOrThrow).toHaveBeenCalledWith({ where: { name: "SUBSCRIBER" }, select: { id: true } });
    expect(prisma.siteSettings.findUnique).not.toHaveBeenCalled();
  });

  it("fails closed if the public registration role is absent", async () => {
    prisma.role.findUniqueOrThrow.mockRejectedValue(new Error("Role missing"));
    await getAuth();
    const before = configureAuth.mock.calls[0]?.[0].databaseHooks?.user?.create?.before;
    if (!before) throw new Error("Missing registration authorization hook");
    await expect(before({ id: "new", name: "New", email: "new@example.com", emailVerified: false, createdAt: new Date(), updatedAt: new Date() }, null)).rejects.toThrow("Role missing");
  });

  it("assigns SUBSCRIBER to roleless sessions without overwriting a concurrent role change", async () => {
    role = "SUBSCRIBER";
    prisma.user.findUnique.mockResolvedValueOnce({ roleId: null }).mockResolvedValueOnce({ role: { name: "SUBSCRIBER" } });
    expect((await getSessionWithRole())?.user.role).toBe("SUBSCRIBER");
    expect(prisma.user.updateMany).toHaveBeenCalledWith({ where: { id: "author-1", roleId: null }, data: { roleId: "subscriber-role" } });
    expect(prisma.siteSettings.findUnique).not.toHaveBeenCalled();
  });
});
