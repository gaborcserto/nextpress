import { beforeEach, describe, expect, it, vi } from "vitest";

import { ContentNotFoundError } from "@/lib/auth/content-access";
import { requirePrivateDraftAdmission } from "@/lib/services/private-draft-admission.server";
import { WorkingAggregateConflictError } from "@/lib/services/working-aggregate";
import {
  loadWorkingAggregate,
  saveWorkingAggregate,
} from "@/lib/services/working-aggregate-persistence.server";
import { WorkingAggregateSchema } from "@/lib/validation/working-aggregate";

import { GET, PUT } from "./route";

import type { ContentActor } from "@/lib/auth/content-access";

const actor: ContentActor = { id: "author", role: "AUTHOR" };

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));
vi.mock("@/lib/services/private-draft-admission.server", async (original) => ({
  ...(await original<
    typeof import("@/lib/services/private-draft-admission.server")
  >()),
  requirePrivateDraftAdmission: vi.fn(),
}));
vi.mock("@/lib/services/working-aggregate-persistence.server", () => ({
  loadWorkingAggregate: vi.fn(),
  saveWorkingAggregate: vi.fn(),
}));
// Middleware security is exercised separately in content-access.test.ts.
vi.mock("@/lib/auth/auth-server", () => ({
  withAuth:
    (
      _roles: string[],
      handler: (
        req: Request,
        ctx: { params: { id: string } },
        auth: { session: { user: ContentActor } },
      ) => Promise<Response>,
    ) =>
    async (req: Request, ctx: { params: Promise<{ id: string }> }) =>
      handler(req, { params: await ctx.params }, { session: { user: actor } }),
}));

const context = { params: Promise.resolve({ id: "page" }) };
const command = {
  requestId: "12345678-1234-4234-8234-123456789abc",
  expectedDraftVersion: 0,
  expectedSourceVersion: 2,
  edit: {
    expectedVersion: 1,
    expectedFingerprint: "a".repeat(64),
    patch: { title: "Private" },
  },
};

function request(body: unknown) {
  return new Request("http://localhost/api/private-drafts/page", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("private draft route adapter", () => {
  it("loads using the present actor and emits private no-store metadata", async () => {
    const aggregate = WorkingAggregateSchema.parse({
      contractVersion: 1,
      pageId: "page",
      kind: "PAGE",
      ownerId: "author",
      baseVersion: 1,
      baseFingerprint: "a".repeat(64),
      rawPageDocument: null,
      publicState: { status: "PUBLISHED", publishedAt: "2020-01-01T00:00:00Z" },
      publicationIntent: { action: "PRESERVE" },
      snapshot: {
        schemaVersion: 1,
        fields: {
          title: "Original",
          slug: "original",
          content: "",
          excerpt: null,
          pageDocument: null,
          layout: "STANDARD",
          inHeaderMenu: false,
          inFooterMenu: false,
          parentId: null,
          listingKind: null,
          listingTaxonomyId: null,
          eventStart: null,
          eventEnd: null,
          eventLocation: null,
          registrationUrl: null,
          redirectTo: null,
        },
        relationships: {
          coverId: null,
          tagIds: [],
          categoryIds: [],
          gallery: [],
        },
        extensions: { schemaVersion: 1, values: {} },
      },
    });
    vi.mocked(loadWorkingAggregate).mockResolvedValueOnce({
      version: 0,
      sourceVersion: 2,
      aggregate,
    });
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(loadWorkingAggregate).toHaveBeenCalledWith({}, "page", actor, {
      includeSourceMetadata: true,
    });
    expect(requirePrivateDraftAdmission).toHaveBeenCalledOnce();
  });

  it("forwards exact request identity and tokens on repeated logical attempts", async () => {
    await PUT(request(command), context);
    await PUT(request(command), context);
    expect(saveWorkingAggregate).toHaveBeenCalledTimes(2);
    expect(saveWorkingAggregate).toHaveBeenNthCalledWith(
      1,
      {},
      { ...command, pageId: "page" },
      actor,
    );
    expect(saveWorkingAggregate).toHaveBeenNthCalledWith(
      2,
      {},
      { ...command, pageId: "page" },
      actor,
    );
  });

  it.each([
    { ...command, pageId: "another-user-page" },
    { ...command, requestId: "invalid" },
    { ...command, expectedDraftVersion: -1 },
    { ...command, edit: { ...command.edit, patch: { authorId: "other" } } },
    {
      ...command,
      edit: { ...command.edit, patch: { coverId: "unsupported" } },
    },
  ])(
    "rejects malformed or unsupported commands without persistence",
    async (body) => {
      expect((await PUT(request(body), context)).status).toBe(400);
      expect(saveWorkingAggregate).not.toHaveBeenCalled();
    },
  );

  it("reports source conflict without accepting edits or exposing internals", async () => {
    vi.mocked(saveWorkingAggregate).mockRejectedValueOnce(
      new WorkingAggregateConflictError("SOURCE_VERSION_CONFLICT"),
    );
    const response = await PUT(request(command), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "SOURCE_VERSION_CONFLICT",
    });
  });

  it("hides content outside the actor's current ownership", async () => {
    vi.mocked(loadWorkingAggregate).mockRejectedValueOnce(
      new ContentNotFoundError(),
    );
    expect((await GET(new Request("http://localhost"), context)).status).toBe(
      404,
    );
  });

  it("does not expose database details", async () => {
    vi.mocked(saveWorkingAggregate).mockRejectedValueOnce(
      new Error("secret SQL"),
    );
    const response = await PUT(request(command), context);
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("secret SQL");
  });
});
