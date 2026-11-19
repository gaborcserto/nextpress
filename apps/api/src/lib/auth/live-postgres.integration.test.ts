import { EMPTY_RICH_CONTENT } from "@nextpress/shared/content";
import {
  SettingsResponseSchema,
  SettingsSavedSchema,
} from "@nextpress/shared/settings-contracts";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { disposableDatabaseName } from "../testing/disposable-database";
import { verifyDisposableDatabase } from "../testing/docker-database";

const origin = "http://localhost:49101";
const password = "phase 13.10.1 integration passphrase";
const testDatabaseUrl = process.env.NEXTPRESS_SECURITY_TEST_DATABASE_URL;
const runId = randomUUID();
const signupEmail = `integration-${runId}@example.invalid`;
const roleEmails = ["admin", "editor", "author"].map(
  (role) => `${role}-${runId}@example.invalid`,
);
const pageSlug = `integration-owned-${runId}`;
const invalidPageSlug = `integration-invalid-owner-${runId}`;
const tagSlug = `integration-tag-${runId}`;
const settingsEmail = `settings-${runId}@example.invalid`;
const revisionEmail = `revision-${runId}@example.invalid`;
const revisionPageSlug = `integration-revisions-${runId}`;
const { requestHeaders } = vi.hoisted(() => ({
  requestHeaders: vi.fn(async () => new Headers()),
}));
vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: requestHeaders,
}));

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
  const value = response.headers
    .getSetCookie()
    .find((header) => header.startsWith("better-auth.session_token="));

  if (!value) {
    throw new Error("Expected a development session cookie");
  }

  return value.split(";", 1)[0];
}

async function sessionToken(response: Response) {
  const body: unknown = await response.json();

  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    throw new Error("Expected an authentication session token");
  }

  return body.token;
}

describe.skipIf(!testDatabaseUrl)(
  "local PostgreSQL security integration",
  () => {
    beforeAll(async () => {
      const configuredTestDatabaseUrl = testDatabaseUrl;

      if (!configuredTestDatabaseUrl) {
        throw new Error("Missing isolated integration database URL");
      }

      const expectedName = disposableDatabaseName(
        configuredTestDatabaseUrl,
        process.env.DATABASE_URL,
        "security",
      );
      const candidate = (await import("@nextpress/db/src/client")).prisma;
      await verifyDisposableDatabase(expectedName, candidate);
      prisma = candidate;
      ({ getAuth, getUserRole } = await import("./auth-server"));
      vi.stubEnv("BETTER_AUTH_URL", origin);
      vi.stubEnv(
        "BETTER_AUTH_SECRET",
        "phase-13-10-1-local-integration-secret",
      );
      const roles = await prisma.role.findMany({
        where: { name: { in: ["ADMIN", "EDITOR", "AUTHOR", "SUBSCRIBER"] } },
        select: { name: true },
      });

      if (roles.length !== 4) {
        throw new Error(
          "Seed the standard roles before running the PostgreSQL security integration test",
        );
      }
    });

    afterAll(async () => {
      vi.unstubAllEnvs();

      if (!prisma) {
        return;
      }

      await verifyDisposableDatabase(
        disposableDatabaseName(
          testDatabaseUrl,
          process.env.DATABASE_URL,
          "security",
        ),
        prisma,
      );

      try {
        await prisma.page.deleteMany({
          where: {
            slug: { in: [pageSlug, invalidPageSlug, revisionPageSlug] },
          },
        });
        await prisma.taxonomy.deleteMany({ where: { slug: tagSlug } });
        await prisma.user.deleteMany({
          where: {
            email: {
              in: [signupEmail, settingsEmail, revisionEmail, ...roleEmails],
            },
          },
        });
      } finally {
        await prisma.$disconnect();
      }
    });

    it("persists credentials, roles, sessions, password-change revocation, and logout", async () => {
      const auth = await getAuth();

      const signup = await auth.handler(
        authRequest("/sign-up/email", {
          name: "Integration User",
          email: signupEmail,
          password,
        }),
      );
      expect(signup.status).toBe(200);

      const user = await prisma.user.findUnique({
        where: { email: signupEmail },
        include: { role: true, accounts: true },
      });

      if (!user) {
        throw new Error("Expected signup to persist its user");
      }

      expect(user).toMatchObject({
        role: { name: "SUBSCRIBER" },
        accounts: [{ provider: "credential" }],
      });
      expect(await getUserRole(user.id)).toBe("SUBSCRIBER");

      const signIn = await auth.handler(
        authRequest("/sign-in/email", {
          email: signupEmail,
          password,
        }),
      );
      expect(signIn.status).toBe(200);
      const oldCookie = sessionCookie(signIn);
      const oldToken = await sessionToken(signIn);
      expect(
        await prisma.session.findUnique({ where: { sessionToken: oldToken } }),
      ).toMatchObject({ userId: user.id });

      const changed = await auth.handler(
        authRequest(
          "/change-password",
          {
            currentPassword: password,
            newPassword: "phase 13.10.1 replacement passphrase",
            revokeOtherSessions: false,
          },
          oldCookie,
        ),
      );
      expect(changed.status).toBe(200);
      expect(
        await prisma.session.findUnique({ where: { sessionToken: oldToken } }),
      ).toBeNull();
      const newCookie = sessionCookie(changed);
      const newToken = await sessionToken(changed);
      expect(
        await prisma.session.findUnique({ where: { sessionToken: newToken } }),
      ).toMatchObject({ userId: user.id });

      const logout = await auth.handler(
        authRequest("/sign-out", {}, newCookie),
      );
      expect(logout.status).toBe(200);
      expect(
        await prisma.session.findUnique({ where: { sessionToken: newToken } }),
      ).toBeNull();
    });

    it("reads persisted elevated roles and enforces relational uniqueness and transaction rollback", async () => {
      const roles = ["ADMIN", "EDITOR", "AUTHOR"] as const;
      const users = await Promise.all(
        roles.map((name) =>
          prisma.user.create({
            data: {
              email: `${name.toLowerCase()}-${runId}@example.invalid`,
              role: { connect: { name } },
            },
            select: { id: true, role: { select: { name: true } } },
          }),
        ),
      );

      for (const [index, user] of users.entries()) {
        expect(user.role?.name).toBe(roles[index]);
        expect(await getUserRole(user.id)).toBe(roles[index]);
      }

      const author = users.at(2);

      if (!author) {
        throw new Error("Expected an AUTHOR role user");
      }

      const page = await prisma.page.create({
        data: {
          type: "PAGE",
          status: "DRAFT",
          slug: pageSlug,
          title: "Owned",
          content: "",
          authorId: author.id,
        },
      });

      const tag = await prisma.taxonomy.create({
        data: { type: "TAG", slug: tagSlug, name: "Integration" },
      });
      await prisma.$transaction(async (tx) => {
        await tx.pageOnTaxonomy.create({
          data: { pageId: page.id, taxonomyId: tag.id },
        });
      });
      await expect(
        prisma.pageOnTaxonomy.create({
          data: { pageId: page.id, taxonomyId: tag.id },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.pageOnTaxonomy.deleteMany({ where: { pageId: page.id } });
          await tx.pageOnTaxonomy.create({
            data: { pageId: page.id, taxonomyId: "missing-taxonomy" },
          });
        }),
      ).rejects.toMatchObject({ code: "P2003" });
      expect(
        await prisma.pageOnTaxonomy.findMany({ where: { pageId: page.id } }),
      ).toEqual([
        expect.objectContaining({ pageId: page.id, taxonomyId: tag.id }),
      ]);
      await expect(
        prisma.page.create({
          data: {
            type: "PAGE",
            status: "DRAFT",
            slug: invalidPageSlug,
            title: "Invalid",
            content: "",
            authorId: "missing-user",
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });

    it("returns committed legacy revision identities for restore and publication", async () => {
      const { revisionAction, saveRevision } =
        await import("../services/revisions.server");

      const author = await prisma.user.create({
        data: {
          email: revisionEmail,
          role: { connect: { name: "AUTHOR" } },
        },
      });

      const page = await prisma.page.create({
        data: {
          type: "PAGE",
          status: "DRAFT",
          slug: revisionPageSlug,
          title: "Legacy revision",
          content: EMPTY_RICH_CONTENT,
          authorId: author.id,
        },
      });
      const actor = { id: author.id, role: "AUTHOR" as const };
      const saved = await saveRevision(
        page.id,
        {
          expectedVersion: page.workingVersion,
          title: "Saved snapshot",
          slug: page.slug,
          content: EMPTY_RICH_CONTENT,
          excerpt: EMPTY_RICH_CONTENT,
          layout: "STANDARD",
          pageDocument: null,
        },
        actor,
      );

      const restored = await revisionAction(
        page.id,
        {
          action: "restore",
          expectedVersion: saved.workingVersion,
          revisionId: saved.id,
        },
        actor,
      );

      expect(restored.result.id).not.toBe(saved.id);
      expect(restored.audit).toEqual({
        action: "restore",
        targetId: page.id,
        revisionId: restored.result.id,
      });
      const persisted = await prisma.pageRevision.findUniqueOrThrow({
        where: { id: restored.result.id },
      });

      const published = await revisionAction(
        page.id,
        {
          action: "publish",
          expectedVersion: persisted.workingVersion,
          revisionId: persisted.id,
        },
        actor,
      );

      expect(published.result).toMatchObject({
        id: page.id,
        status: "PUBLISHED",
      });
      expect(published.audit).toEqual({
        action: "publish",
        targetId: page.id,
        sourceRevisionId: persisted.id,
      });
    });

    it("reports environment fallback after clearing a stored client ID in PostgreSQL", async () => {
      const auth = await getAuth();

      const signup = await auth.handler(
        authRequest("/sign-up/email", {
          name: "Settings integration admin",
          email: settingsEmail,
          password,
        }),
      );
      expect(signup.status).toBe(200);
      await prisma.user.update({
        where: { email: settingsEmail },
        data: { role: { connect: { name: "ADMIN" } } },
      });
      const signIn = await auth.handler(
        authRequest("/sign-in/email", { email: settingsEmail, password }),
      );
      expect(signIn.status).toBe(200);
      const cookie = sessionCookie(signIn);
      requestHeaders.mockResolvedValue(new Headers({ cookie }));
      vi.stubEnv("GITHUB_CLIENT_ID", "synthetic-fallback-client");
      vi.stubEnv("GITHUB_CLIENT_SECRET", "synthetic-fallback-secret");

      try {
        const { GET, PUT } = await import("@/app/api/admin/settings/route");
        const url = `${origin}/api/admin/settings`;
        const context = { params: {} };
        const response = await GET(new Request(url), context);
        expect(response.status).toBe(200);
        const settings = SettingsResponseSchema.parse(await response.json());
        await prisma.oAuthProvider.update({
          where: { provider: "github" },
          data: { clientId: "synthetic-stored-client", clientSecret: null },
        });
        const saved = await PUT(
          new Request(url, {
            method: "PUT",
            headers: { origin, "content-type": "application/json" },
            body: JSON.stringify({
              ...settings,
              siteName: "NextPress",
              oauthProviders: settings.oauthProviders.map((row) => ({
                ...row,
                ...(row.provider === "github"
                  ? { enabled: true, clientId: "", clientSecret: "  " }
                  : {}),
              })),
            }),
          }),
          context,
        );

        expect(saved.status).toBe(200);
        const body = await saved.text();
        expect(/synthetic-fallback|clientSecret|clientId/.test(body)).toBe(
          false,
        );
        const status = SettingsSavedSchema.parse(JSON.parse(body));
        expect(
          status.oauthProviders.find((row) => row.provider === "github"),
        ).toEqual({
          provider: "github",
          hasClientId: true,
          hasClientSecret: true,
          operational: true,
        });

        const stored = await prisma.oAuthProvider.findUniqueOrThrow({
          where: { provider: "github" },
          select: { enabled: true, clientId: true, clientSecret: true },
        });
        expect(
          stored.enabled &&
            stored.clientId === null &&
            stored.clientSecret === null,
        ).toBe(true);
      } finally {
        requestHeaders.mockReset();
      }
    });
  },
);
