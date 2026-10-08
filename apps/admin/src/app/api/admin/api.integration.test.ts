import { APIError } from "better-auth/api";
import { describe, expect, beforeEach, it, vi } from "vitest";

const { authState, prisma, bcryptHash, getDefaultUserRole, authHandler } = vi.hoisted(() => ({
  authState: { role: "ADMIN" as "ADMIN" | "EDITOR" | null },
  prisma: {
    siteSettings: { upsert: vi.fn() },
    oAuthProvider: { upsert: vi.fn(), findMany: vi.fn() },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  bcryptHash: vi.fn(),
  getDefaultUserRole: vi.fn(),
  authHandler: vi.fn(),
}));

vi.mock("@nextpress/db/src/client", () => ({ prisma }));

vi.mock("bcryptjs", () => ({ default: { hash: bcryptHash } }));

vi.mock("@/lib/settings/site-settings", () => ({
  FALLBACK_USER_ROLE: "SUBSCRIBER",
  SITE_SETTINGS_ID: "default",
  getDefaultUserRole,
}));

vi.mock("@/lib/auth/auth-server", () => ({
  getAuth: vi.fn(async () => ({ handler: authHandler, $context: Promise.resolve({ password: { hash: bcryptHash } }) })),
  withAuth: (allowed: string[], handler: Function) =>
    async (request: Request, context: { params?: Record<string, string> } = {}) => {
      if (!authState.role) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!allowed.includes(authState.role)) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      return handler(
        request,
        { params: context.params ?? {} },
        { session: { user: { id: "admin-1", role: authState.role } }, roleName: authState.role },
      );
    },
}));

import { GET as getSettings, PUT as putSettings } from "./settings/route";
import { PATCH as updateUserRole } from "./users/[id]/role/route";
import { DELETE as deleteUser } from "./users/[id]/route";
import { POST as createUser } from "./users/create/route";
import { GET as getUsers } from "./users/route";
import { GET as authGet, POST as authPost } from "../auth/[...all]/route";

const providers = ["apple", "discord", "facebook", "github", "google", "twitter"] as const;

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/admin/test", {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function json(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

function settingsPayload() {
  return {
    siteName: " NextPress ",
    siteDescription: "A site",
    siteUrl: "https://example.com",
    ogImageUrl: "",
    defaultUserRole: "SUBSCRIBER",
    postListingMode: "PAGINATION",
    postsPerPage: 10,
    oauthProviders: providers.map((provider) => ({
      provider,
      enabled: false,
      clientId: "",
    })),
  };
}

beforeEach(() => {
  authState.role = "ADMIN";
  vi.clearAllMocks();
  getDefaultUserRole.mockResolvedValue("SUBSCRIBER");
  authHandler.mockResolvedValue(Response.json({ handled: true }));
  bcryptHash.mockResolvedValue("hashed-password");
  prisma.siteSettings.upsert.mockResolvedValue({
    id: "default",
    siteName: "NextPress",
    siteDescription: "A site",
    siteUrl: "https://example.com",
    ogImageUrl: null,
    defaultUserRole: "SUBSCRIBER",
    postListingMode: "PAGINATION",
    postsPerPage: 10,
  });
  prisma.oAuthProvider.upsert.mockResolvedValue({ id: "provider-1" });
  prisma.oAuthProvider.findMany.mockResolvedValue(
    providers.map((provider) => ({
      provider,
      enabled: false,
      clientId: null,
      clientSecret: null,
    })),
  );
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  );
});

describe("admin API route integration", () => {
  it.each([
    ["GET", authGet],
    ["POST", authPost],
  ])("delegates Better Auth %s requests to the configured auth handler", async (method, route) => {
    const req = request(method);

    const response = await route(req);

    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ handled: true });
    expect(authHandler).toHaveBeenCalledWith(req);
  });

  describe("authentication and users", () => {
    it("rejects an unauthenticated users request", async () => {
      authState.role = null;

      const response = await getUsers(request("GET"), { params: {} });

      expect(response.status).toBe(401);
      expect(await json(response)).toEqual({ error: "Unauthorized" });
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("rejects an authenticated non-admin users request", async () => {
      authState.role = "EDITOR";

      const response = await getUsers(request("GET"), { params: {} });

      expect(response.status).toBe(403);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it("lists users for an admin and flattens the related role", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "user-1",
          name: "Ada",
          email: "ada@example.com",
          emailVerified: true,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-02"),
          role: { name: "EDITOR" },
        },
        {
          id: "user-2",
          name: null,
          email: "missing-role@example.com",
          emailVerified: false,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          role: null,
        },
      ]);

      const response = await getUsers(request("GET"), { params: {} });

      expect(response.status).toBe(200);
      expect(await json(response)).toEqual([
        expect.objectContaining({ id: "user-1", roleName: "EDITOR" }),
        expect.objectContaining({ id: "user-2", roleName: null }),
      ]);
    });

    it("maps a users repository failure to a stable 500 response", async () => {
      prisma.user.findMany.mockRejectedValue(new Error("database unavailable"));

      const response = await getUsers(request("GET"), { params: {} });

      expect(response.status).toBe(500);
      expect(await json(response)).toEqual({ error: "Unexpected error" });
    });
  });

  it("returns retryable 429 when admin provisioning encounters saturated password work", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    bcryptHash.mockRejectedValueOnce(new APIError("TOO_MANY_REQUESTS", { message: "Too many requests" }));
    const response = await createUser(request("POST", { name: "New", email: "new@example.com", role: "SUBSCRIBER", password: "a long passphrase" }), { params: {} });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("1");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  describe("settings", () => {
    it("retrieves settings and provider status for an admin", async () => {
      prisma.oAuthProvider.findMany.mockResolvedValue(
        providers.map((provider) => ({
          provider,
          enabled: provider === "google",
          clientId: provider === "google" ? "google-client" : null,
          clientSecret: provider === "google" ? "google-secret" : null,
        })),
      );

      const response = await getSettings(request("GET"), { params: {} });
      const body = await json(response);

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        siteName: "NextPress", defaultUserRole: "SUBSCRIBER",
        postListingMode: "PAGINATION", postsPerPage: 10,
      });
      expect(body.oauthProviders).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            provider: "google",
            operational: true,
            hasClientId: true,
            hasClientSecret: true,
          }),
        ]),
      );
    });

    it("persists a valid settings update and preserves an existing omitted secret", async () => {
      prisma.oAuthProvider.findMany.mockResolvedValue(
        providers.map((provider) => ({
          provider,
          enabled: provider === "google",
          clientId: provider === "google" ? "old-client" : null,
          clientSecret: provider === "google" ? "existing-secret" : null,
        })),
      );

      const response = await putSettings(request("PUT", {
        ...settingsPayload(),
        postListingMode: "LOAD_MORE",
        postsPerPage: 25,
        oauthProviders: settingsPayload().oauthProviders.map((provider) =>
          provider.provider === "google"
            ? { ...provider, enabled: true, clientId: "new-client" }
            : provider,
        ),
      }), { params: {} });

      expect(response.status).toBe(200);
      expect(await json(response)).toEqual({ ok: true });
      expect(prisma.siteSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            siteName: "NextPress", postListingMode: "LOAD_MORE", postsPerPage: 25,
          }),
        }),
      );
      expect(prisma.oAuthProvider.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { provider: "google" },
          update: expect.objectContaining({ clientId: "new-client" }),
        }),
      );
      expect(prisma.oAuthProvider.upsert.mock.calls.at(-1)).toBeDefined();
      const googleCall = prisma.oAuthProvider.upsert.mock.calls.find(
        ([value]) => value.where.provider === "google",
      );
      expect(googleCall?.[0].update).not.toHaveProperty("clientSecret");
    });

    it.each([
      ["invalid JSON", new Request("http://localhost/api/admin/settings", { method: "PUT", body: "{" })],
      ["invalid provider set", request("PUT", { ...settingsPayload(), oauthProviders: [] })],
      ["invalid URL", request("PUT", { ...settingsPayload(), siteUrl: "ftp://example.com" })],
      ["invalid listing mode", request("PUT", { ...settingsPayload(), postListingMode: "INFINITE_SCROLL" })],
      ["too few posts per page", request("PUT", { ...settingsPayload(), postsPerPage: 0 })],
      ["too many posts per page", request("PUT", { ...settingsPayload(), postsPerPage: 51 })],
      ["fractional posts per page", request("PUT", { ...settingsPayload(), postsPerPage: 1.5 })],
    ])("rejects %s with a 400 response", async (_name, req) => {
      const response = await putSettings(req, { params: {} });

      expect(response.status).toBe(400);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects an enabled provider without credentials", async () => {
      const payload = settingsPayload();
      payload.oauthProviders[0] = { provider: "apple", enabled: true, clientId: "" };

      const response = await putSettings(request("PUT", payload), { params: {} });

      expect(response.status).toBe(400);
      expect(await json(response)).toEqual({ error: "Provider apple is missing required credentials" });
    });

    it("does not leak settings persistence failures", async () => {
      prisma.oAuthProvider.findMany.mockRejectedValue(new Error("secret database detail"));

      const response = await putSettings(request("PUT", settingsPayload()), { params: {} });

      expect(response.status).toBe(500);
      expect(await json(response)).toEqual({ error: "Unexpected error" });
    });
  });

  describe("user mutations", () => {
    it("creates a user with the configured default role", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "new@example.com",
        name: "New User",
        role: { name: "SUBSCRIBER" },
      });

      const response = await createUser(request("POST", {
        email: " New@Example.com ",
        name: " New User ",
        password: "a long passphrase",
      }), { params: {} });

      expect(response.status).toBe(201);
      expect(await json(response)).toEqual({
        id: "user-1",
        email: "new@example.com",
        name: "New User",
        role: { name: "SUBSCRIBER" },
        roleName: "SUBSCRIBER",
      });
      expect(bcryptHash).toHaveBeenCalledWith("a long passphrase");
      const data = prisma.user.create.mock.calls[0]?.[0].data;
      expect(data.accounts.create).toEqual({ provider: "credential", providerAccountId: data.id, password: "hashed-password" });
    });

    it("rejects malformed user creation input", async () => {
      const response = await createUser(request("POST", { email: "not-an-email", role: "OWNER" }), {
        params: {},
      });

      expect(response.status).toBe(400);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      { email: "not-an-email" },
      { email: "user@example.com", password: "short" },
      { email: "user@example.com", password: "" },
      { email: "user@example.com", password: "a".repeat(129) },
      { email: "user@example.com", password: "😀".repeat(8) },
    ])("rejects invalid credential provisioning before persistence: %j", async (body) => {
      const response = await createUser(request("POST", body), { params: {} });
      expect(response.status).toBe(400);
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(bcryptHash).not.toHaveBeenCalled();
    });

    it("returns a conflict for an existing email", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing" });

      const response = await createUser(request("POST", { email: "existing@example.com" }), {
        params: {},
      });

      expect(response.status).toBe(409);
      expect(await json(response)).toEqual({ error: "Email already exists" });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it("updates a valid role and rejects unsupported roles", async () => {
      const invalid = await updateUserRole(request("PATCH", { role: "OWNER" }), {
        params: { id: "user-1" },
      });
      expect(invalid.status).toBe(400);

      prisma.user.update.mockResolvedValue({ id: "user-1", role: { name: "EDITOR" } });
      const valid = await updateUserRole(request("PATCH", { role: "EDITOR" }), {
        params: { id: "user-1" },
      });

      expect(valid.status).toBe(200);
      expect(await json(valid)).toEqual({ id: "user-1", roleName: "EDITOR" });
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: "user-1" },
        data: { role: { connect: { name: "EDITOR" } } },
      }));
    });

    it("returns 404 when deleting a missing user", async () => {
      prisma.user.delete.mockRejectedValue({ code: "P2025" });

      const response = await deleteUser(request("DELETE"), { params: { id: "missing" } });

      expect(response.status).toBe(404);
      expect(await json(response)).toEqual({ error: "User not found" });
    });
  });
});
