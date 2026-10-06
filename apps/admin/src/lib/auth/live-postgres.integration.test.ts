import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const origin = "http://localhost:49101";
const password = "phase 13.10.1 integration passphrase";
const testDatabaseUrl = process.env.NEXTPRESS_SECURITY_TEST_DATABASE_URL;
const runId = randomUUID();
const signupEmail = `integration-${runId}@example.invalid`;
const roleEmails = ["admin", "editor", "author"].map((role) => `${role}-${runId}@example.invalid`);
const pageSlug = `integration-owned-${runId}`;
const invalidPageSlug = `integration-invalid-owner-${runId}`;
const tagSlug = `integration-tag-${runId}`;
let prisma!: typeof import("@nextpress/db/src/client").prisma;
let getAuth!: typeof import("./auth-server").getAuth;
let getUserRole!: typeof import("./auth-server").getUserRole;

function authRequest(path: string, body: unknown, cookie?: string) {
  return new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: {
      origin,
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function sessionCookie(response: Response) {
  const value = response.headers.getSetCookie().find((header) => header.startsWith("better-auth.session_token="));
  if (!value) throw new Error("Expected a development session cookie");
  return value.split(";", 1)[0];
}

async function sessionToken(response: Response) {
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("token" in body) || typeof body.token !== "string") {
    throw new Error("Expected an authentication session token");
  }
  return body.token;
}

describe.skipIf(!testDatabaseUrl)("local PostgreSQL security integration", () => {
  beforeAll(async () => {
    const configuredTestDatabaseUrl = testDatabaseUrl;
    if (!configuredTestDatabaseUrl) throw new Error("Missing isolated integration database URL");
    const actualUrl = new URL(process.env.DATABASE_URL ?? "");
    const requestedUrl = new URL(configuredTestDatabaseUrl);
    const databaseName = requestedUrl.pathname.slice(1);
    if (actualUrl.toString() !== requestedUrl.toString() ||
      !["localhost", "127.0.0.1"].includes(requestedUrl.hostname) ||
      !(databaseName === "cms" || databaseName.startsWith("nextpress_security_verify_"))) {
      throw new Error("Set both database URLs to the same local cms or nextpress_security_verify_* database");
    }
    prisma = (await import("@nextpress/db/src/client")).prisma;
    ({ getAuth, getUserRole } = await import("./auth-server"));
    vi.stubEnv("BETTER_AUTH_URL", origin);
    vi.stubEnv("BETTER_AUTH_SECRET", "phase-13-10-1-local-integration-secret");
    const roles = await prisma.role.findMany({ where: { name: { in: ["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"] } }, select: { name: true } });
    if (roles.length !== 4) throw new Error("Seed the standard roles before running the PostgreSQL security integration test");
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    if (!prisma) return;
    try {
      await prisma.page.deleteMany({ where: { slug: { in: [pageSlug, invalidPageSlug] } } });
      await prisma.taxonomy.deleteMany({ where: { slug: tagSlug } });
      await prisma.user.deleteMany({ where: { email: { in: [signupEmail, ...roleEmails] } } });
    } finally {
      await prisma.$disconnect();
    }
  });

  it("persists credentials, roles, sessions, password-change revocation, and logout", async () => {
    const auth = await getAuth();
    const signup = await auth.handler(authRequest("/sign-up/email", {
      name: "Integration User", email: signupEmail, password,
    }));
    expect(signup.status).toBe(200);

    const user = await prisma.user.findUnique({
      where: { email: signupEmail },
      include: { role: true, accounts: true },
    });
    if (!user) throw new Error("Expected signup to persist its user");
    expect(user).toMatchObject({ role: { name: "SUBSCRIBER" }, accounts: [{ provider: "credential" }] });
    expect(await getUserRole(user.id)).toBe("SUBSCRIBER");

    const signIn = await auth.handler(authRequest("/sign-in/email", {
      email: signupEmail, password,
    }));
    expect(signIn.status).toBe(200);
    const oldCookie = sessionCookie(signIn);
    const oldToken = await sessionToken(signIn);
    expect(await prisma.session.findUnique({ where: { sessionToken: oldToken } })).toMatchObject({ userId: user.id });

    const changed = await auth.handler(authRequest("/change-password", {
      currentPassword: password,
      newPassword: "phase 13.10.1 replacement passphrase",
      revokeOtherSessions: false,
    }, oldCookie));
    expect(changed.status).toBe(200);
    expect(await prisma.session.findUnique({ where: { sessionToken: oldToken } })).toBeNull();
    const newCookie = sessionCookie(changed);
    const newToken = await sessionToken(changed);
    expect(await prisma.session.findUnique({ where: { sessionToken: newToken } })).toMatchObject({ userId: user.id });

    const logout = await auth.handler(authRequest("/sign-out", {}, newCookie));
    expect(logout.status).toBe(200);
    expect(await prisma.session.findUnique({ where: { sessionToken: newToken } })).toBeNull();
  });

  it("reads persisted elevated roles and enforces relational uniqueness and transaction rollback", async () => {
    const roles = ["ADMIN", "EDITOR", "AUTHOR"] as const;
    const users = await Promise.all(roles.map((name) => prisma.user.create({
      data: {
        email: `${name.toLowerCase()}-${runId}@example.invalid`,
        role: { connect: { name } },
      },
      select: { id: true, role: { select: { name: true } } },
    })));
    for (const [index, user] of users.entries()) {
      expect(user.role?.name).toBe(roles[index]);
      expect(await getUserRole(user.id)).toBe(roles[index]);
    }

    const author = users.at(2);
    if (!author) throw new Error("Expected an AUTHOR role user");
    const page = await prisma.page.create({
      data: {
        type: "PAGE", status: "DRAFT", slug: pageSlug, title: "Owned", content: "",
        authorId: author.id,
      },
    });
    const tag = await prisma.taxonomy.create({ data: { type: "TAG", slug: tagSlug, name: "Integration" } });
    await prisma.$transaction(async (tx) => {
      await tx.pageOnTaxonomy.create({ data: { pageId: page.id, taxonomyId: tag.id } });
    });
    await expect(prisma.pageOnTaxonomy.create({ data: { pageId: page.id, taxonomyId: tag.id } })).rejects.toMatchObject({ code: "P2002" });
    await expect(prisma.$transaction(async (tx) => {
      await tx.pageOnTaxonomy.deleteMany({ where: { pageId: page.id } });
      await tx.pageOnTaxonomy.create({ data: { pageId: page.id, taxonomyId: "missing-taxonomy" } });
    })).rejects.toMatchObject({ code: "P2003" });
    expect(await prisma.pageOnTaxonomy.findMany({ where: { pageId: page.id } })).toEqual([
      expect.objectContaining({ pageId: page.id, taxonomyId: tag.id }),
    ]);
    await expect(prisma.page.create({
      data: {
        type: "PAGE", status: "DRAFT", slug: invalidPageSlug, title: "Invalid", content: "",
        authorId: "missing-user",
      },
    })).rejects.toMatchObject({ code: "P2003" });
  });
});
