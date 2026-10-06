import { beforeEach, describe, expect, it, vi } from "vitest";

import { PUT as updateSettings } from "./admin/settings/route";
import { DELETE as deleteAdminTag } from "./admin/tags/[id]/route";
import { PATCH as updateUserRole } from "./admin/users/[id]/role/route";
import { DELETE as deleteUser } from "./admin/users/[id]/route";
import { POST as createUser } from "./admin/users/create/route";
import { GET as readPage, PUT as updatePage, DELETE as deletePage } from "./pages/[id]/route";
import { GET as listPages, POST as createPage } from "./pages/route";
import { GET as readPost, PUT as updatePost, DELETE as deletePost } from "./post/[id]/route";
import { GET as listPosts, POST as createPost } from "./post/route";
import { GET as readLinks, PUT as replaceTags } from "./tags/link/route";
import { POST as createTag, DELETE as deleteTag } from "./tags/route";
import { getAuth, getSessionWithRole } from "@/lib/auth/auth-server";
import type { RoleName } from "@/lib/auth/roles";
import { EMPTY_SLATE_VALUE } from "@/lib/content/editor";
import { actionLimits } from "@/lib/security/rate-limit.server";
import { pageValuesToDto } from "@/lib/services/page.client";
import { postValuesToDto } from "@/lib/services/post.client";
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
    layout: "STANDARD" as const, cover: null, updatedAt: new Date(), publishedAt: null as Date | null, parentId: null, inHeaderMenu: false, inFooterMenu: false,
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
    headers: { origin: "http://localhost:49101", ...(body === undefined ? {} : { "content-type": "application/json" }) },
  });
}
function context(id: string) { return { params: Promise.resolve({ id }) }; }

beforeEach(() => {
  actionLimits.clear();
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
  prisma.page.findUniqueOrThrow.mockImplementation(async ({ where }: { where: Filter }) => {
    const item = records.find((item) => matches(item, where));
    if (!item) throw new Error("Record not found");
    return item;
  });
  prisma.page.update.mockImplementation(async ({ where, data }: { where: Filter; data: Partial<Content> }) => {
    const item = records.find((item) => matches(item, where));
    if (!item) throw new Error("Record not found");
    Object.assign(item, data);
    return item;
  });
  prisma.page.create.mockImplementation(async ({ data }: { data: Content }) => {
    const item = { ...content("created", data.type, data.status), ...data };
    records.push(item);
    return item;
  });
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

describe.each([
  ["POST", createPage], ["PUT", updatePage], ["DELETE", deletePage],
  ["POST", createPost], ["PUT", updatePost], ["DELETE", deletePost],
  ["POST", createTag], ["DELETE", deleteTag], ["PUT", replaceTags],
  ["DELETE", deleteAdminTag], ["PUT", updateSettings], ["POST", createUser],
  ["DELETE", deleteUser], ["PATCH", updateUserRole],
] as const)("custom mutation %s (%#)", (method, mutate) => {
  it.each([undefined, "null", "https://evil.example", "http://localhost:49101/path"])("rejects Origin %s before session lookup or persistence", async (origin) => {
    role = "ADMIN";
    const headers = new Headers({ "content-type": "application/json" });
    if (origin !== undefined) headers.set("origin", origin);
    expect((await mutate(new Request("http://localhost:49101/api/test", {
      method, headers, body: "{}",
    }), context("test"))).status).toBe(403);
    expect(session).not.toHaveBeenCalled();
    expect(prisma.page.update).not.toHaveBeenCalled();
    expect(prisma.page.delete).not.toHaveBeenCalled();
  });

  it("rejects text/plain JSON before session lookup or persistence", async () => {
    role = "ADMIN";
    expect((await mutate(new Request("http://localhost:49101/api/test", {
      method, headers: { origin: "http://localhost:49101", "content-type": "text/plain" }, body: "{}",
    }), context("test"))).status).toBe(415);
    expect(session).not.toHaveBeenCalled();
  });
});

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
    expect(prisma.page.update).toHaveBeenCalledWith({ where: { id: `${prefix}-draft`, type, authorId: "author-1" }, data: { title: "Own edit", status: "DRAFT", publishedAt: undefined } });
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
  it.each(["?page=0", "?page=-1", "?page=1x", "?page=Infinity", "?limit=101", "?page=2&page=3"]) ("rejects invalid pagination %s before querying", async (query) => {
    expect((await listPages(request("GET", undefined, query))).status).toBe(400);
    expect(prisma.page.findMany).not.toHaveBeenCalled();
  });

  it("bounds pagination and accepts the maximum page size", async () => {
    expect((await listPages(request("GET", undefined, "?page=2&limit=100"))).status).toBe(200);
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 100, take: 100 }));
  });

  it("rejects unknown selectors and bounds parent selector results", async () => {
    expect((await listPages(request("GET", undefined, "?select=all"))).status).toBe(400);
    expect(prisma.page.findMany).not.toHaveBeenCalled();
    await listPages(request("GET", undefined, "?select=parent"));
    expect(prisma.page.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 500 }));
  });
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

  it.each([{ ids: ["category-1"] }, { ids: ["missing"] }, { ids: ["tag-1", "category-1"] }, { ids: [5] }, { ids: "tag-1" }, { ids: ["tag-1", "tag-1"] }, { ids: ["x".repeat(65)] }, { ids: Array.from({ length: 101 }, (_, index) => `tag-${index}`) }])("rejects invalid links before destructive writes: %j", async ({ ids }) => {
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

describe("authorized mutation abuse limits", () => {
  it.each(["ADMIN", "EDITOR", "AUTHOR"] as const)("bounds %s content creation across page and post routes before persistence", async (viewer) => {
    role = viewer;
    for (let i = 0; i < 30; i++) {
      const route = i % 2 ? createPage : createPost;
      expect((await route(request("POST", {}), context(""))).status).toBe(400);
    }
    const blocked = await createPage(request("POST", {}), context(""));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect(prisma.page.create).not.toHaveBeenCalled();
    expect((await listPages(request())).status).toBe(200);
  });

  it("combines both tag deletion routes into one user budget", async () => {
    role = "ADMIN";
    prisma.taxonomy.delete.mockResolvedValue({ id: "tag", type: "TAG", name: "Tag", slug: "tag" });
    for (let i = 0; i < 120; i++) {
      const response = i % 2 ? await deleteTag(request("DELETE", undefined, "?id=tag"), context("")) : await deleteAdminTag(request("DELETE"), context("tag"));
      expect(response.status).toBe(200);
    }
    expect((await deleteAdminTag(request("DELETE"), context("tag"))).status).toBe(429);
    expect(prisma.taxonomy.delete).toHaveBeenCalledTimes(120);
  });

  it("shares user-management limits across provisioning, role changes and deletion", async () => {
    role = "ADMIN";
    for (let i = 0; i < 30; i++) expect((await createUser(request("POST", {}), context(""))).status).toBe(400);
    expect((await updateUserRole(request("PATCH", { role: "AUTHOR" }), context("user"))).status).toBe(429);
    expect((await deleteUser(request("DELETE"), context("user"))).status).toBe(429);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
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


describe.each(routes)("$type editor round trip", ({ type, create, update, read }) => {
  it("preserves create and edit content through the real DTO, validator, service, repository and read route", async () => {
    role = "AUTHOR";
    const blocks = [{ type: "heading" as const, level: 2 as const, children: [{ text: "Formatted", bold: true }] }];
    const common = { status: "PUBLISHED" as const, slug: "round-trip", title: "Round trip", content: blocks, tags: [] };
    const dto = type === "PAGE"
      ? pageValuesToDto({ ...common, type: "CONTACT", parentId: null, inHeaderMenu: true, inFooterMenu: false })
      : postValuesToDto({ ...common, excerpt: EMPTY_SLATE_VALUE, cover: null, publishedAt: "2024-02-01T12:00:00.000Z" });
    expect((await create(request("POST", dto), context(""))).status).toBe(201);
    const created = await (await read(request(), context("created"))).json();
    expect(created.item.content).toEqual(blocks);
    if (type === "PAGE") expect(created.item).toMatchObject({ type: "CONTACT", inHeaderMenu: true });
    else expect(created.item.publishedAt).toBe("2024-02-01T12:00:00.000Z");
    const edited = [{ type: "paragraph" as const, children: [{ text: "Edited", italic: true }] }];
    const nextDto = type === "PAGE"
      ? pageValuesToDto({ ...created.item, content: edited })
      : postValuesToDto({ ...created.item, content: edited, excerpt: blocks });
    expect((await update(request("PUT", nextDto), context("created"))).status).toBe(200);
    const result = await (await read(request(), context("created"))).json();
    expect(result.item.content).toEqual(edited);
    if (type === "POST") expect(result.item.excerpt).toEqual(blocks);
  });

  it("returns a stable failure for corrupt stored documents without changing them", async () => {
    role = "AUTHOR";
    const record = records.find((item) => item.id === (type === "PAGE" ? "page-draft" : "post-draft"));
    if (!record) throw new Error("Expected fixture content");
    record.content = '{"version":99,"secret":"private-data"}';
    const response = await read(request(), context(record.id));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("private-data");
    expect(prisma.page.update).not.toHaveBeenCalled();
  });

  it.each(["<script>alert(1)</script>", "[]", '{"version":2,"blocks":[]}'])("rejects invalid rich content before persistence", async (content) => {
    role = "AUTHOR";
    expect((await create(request("POST", { type, status: "DRAFT", slug: "invalid", title: "Invalid", content }), context(""))).status).toBe(400);
    expect(prisma.page.create).not.toHaveBeenCalled();
    expect((await update(request("PUT", { content }), context(type === "PAGE" ? "page-draft" : "post-draft"))).status).toBe(400);
    expect(prisma.page.update).not.toHaveBeenCalled();
  });
});
