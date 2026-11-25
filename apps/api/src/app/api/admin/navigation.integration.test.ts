import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { disposableDatabaseName } from "@/lib/testing/disposable-database";
import { verifyDisposableDatabase } from "@/lib/testing/docker-database";

const { requestHeaders } = vi.hoisted(() => ({
  requestHeaders: vi.fn(async () => new Headers()),
}));

vi.mock("next/headers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/headers")>()),
  headers: requestHeaders,
}));

const origin = "http://localhost:49101";
const password = "Navigation integration passphrase 2026";
const databaseUrl = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
const runId = randomUUID();
const email = `navigation-${runId}@example.invalid`;

let prisma!: typeof import("@nextpress/db/src/client").prisma;
let getAuth!: typeof import("@/lib/auth/auth-server").getAuth;
let postNavigation!: typeof import("./navigation/route").POST;

function authRequest(path: string, body: unknown) {
  return new Request(`${origin}/api/auth${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sessionCookie(response: Response) {
  const value = response.headers
    .getSetCookie()
    .find((header) => header.startsWith("better-auth.session_token="));

  if (!value) {
    throw new Error("Expected an authenticated integration session");
  }

  return value.split(";", 1)[0];
}

describe.skipIf(!databaseUrl)("navigation API persistence integration", () => {
  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("Missing isolated content integration database URL");
    }

    const candidate = (await import("@nextpress/db/src/client")).prisma;
    await verifyDisposableDatabase(
      disposableDatabaseName(databaseUrl, process.env.DATABASE_URL, "content"),
      candidate,
    );
    prisma = candidate;
    ({ getAuth } = await import("@/lib/auth/auth-server"));
    ({ POST: postNavigation } = await import("./navigation/route"));
    vi.stubEnv("BETTER_AUTH_URL", origin);
    vi.stubEnv(
      "BETTER_AUTH_SECRET",
      "navigation-integration-secret-at-least-32-characters",
    );
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    requestHeaders.mockReset();

    if (prisma) {
      await verifyDisposableDatabase(
        disposableDatabaseName(
          databaseUrl,
          process.env.DATABASE_URL,
          "content",
        ),
        prisma,
      );
      await prisma.user.deleteMany({ where: { email } });
      await prisma.$disconnect();
    }
  });

  it("updates the assigned Header through authenticated API and preserves version conflicts", async () => {
    const auth = await getAuth();

    const signup = await auth.handler(
      authRequest("/sign-up/email", {
        name: "Navigation integration admin",
        email,
        password,
      }),
    );
    expect(signup.status).toBe(200);
    await prisma.user.update({
      where: { email },
      data: { role: { connect: { name: "ADMIN" } } },
    });

    const signIn = await auth.handler(
      authRequest("/sign-in/email", { email, password }),
    );
    expect(signIn.status).toBe(200);
    const cookie = sessionCookie(signIn);
    requestHeaders.mockResolvedValue(new Headers({ cookie }));

    const { GET: publicMenus } = await import("../public/menus/route");

    const header = await prisma.navigationMenu.findUniqueOrThrow({
      where: { id: "initial-header" },
      include: {
        assignments: true,
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      },
    });
    expect(header.assignments.map(({ location }) => location)).toContain(
      "header",
    );

    const originalItems = header.items.map(
      ({ id, parentId, kind, label, value, newTab, visible }) => ({
        id,
        parentId,
        kind,
        label,
        value,
        newTab,
        visible,
      }),
    );
    const groupId = `group-${runId}`;
    const nestedId = `nested-${runId}`;
    const reorderedItems = [
      ...originalItems
        .slice(1)
        .reverse()
        .map((item, index) => ({
          ...item,
          visible: index !== 0,
        })),
      {
        id: groupId,
        parentId: null,
        kind: "group" as const,
        label: "Integration group",
        value: "",
        newTab: false,
        visible: true,
      },
      {
        id: nestedId,
        parentId: groupId,
        kind: "external" as const,
        label: "Nested link",
        value: "https://example.test/nested",
        newTab: true,
        visible: true,
      },
    ];
    const menu = {
      name: header.name,
      locations: header.assignments.map(({ location }) => location),
      items: reorderedItems,
    };

    const updateRequest = (version: number, items = menu.items) =>
      new Request(`${origin}/api/admin/navigation`, {
        method: "POST",
        headers: {
          origin,
          cookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "update",
          id: header.id,
          version,
          menu: { ...menu, items },
        }),
      });

    try {
      const saved = await postNavigation(updateRequest(header.version), {
        params: Promise.resolve({}),
      });
      expect(saved.status).toBe(200);
      expect(await saved.json()).toEqual({ id: header.id });

      const persisted = await prisma.navigationMenu.findUniqueOrThrow({
        where: { id: header.id },
        include: {
          assignments: true,
          items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
        },
      });
      expect(persisted.version).toBe(header.version + 1);
      expect(persisted.items.map(({ id }) => id)).toEqual(
        reorderedItems.map(({ id }) => id),
      );
      expect(persisted.items.find(({ id }) => id === nestedId)).toMatchObject({
        parentId: groupId,
        visible: true,
      });
      expect(persisted.items[0]?.visible).toBe(false);

      const firstToReplace = persisted.items[0];

      if (!firstToReplace) {
        throw new Error("Expected a persisted Header item");
      }

      const replacementId = `replacement-${runId}`;
      const replacementItems = [
        ...reorderedItems
          .filter(({ id }) => id !== firstToReplace.id)
          .map((item) => ({ ...item })),
        {
          id: replacementId,
          parentId: null,
          kind: "external" as const,
          label: "Replacement link",
          value: "https://example.test/replacement",
          newTab: false,
          visible: true,
        },
      ];
      const replaced = await postNavigation(
        updateRequest(persisted.version, replacementItems),
        { params: Promise.resolve({}) },
      );
      expect(replaced.status).toBe(200);

      const reloaded = await prisma.navigationMenu.findUniqueOrThrow({
        where: { id: header.id },
        include: { items: { orderBy: [{ position: "asc" }, { id: "asc" }] } },
      });
      expect(reloaded.items).toHaveLength(replacementItems.length);
      expect(reloaded.items.some(({ id }) => id === firstToReplace.id)).toBe(
        false,
      );
      expect(reloaded.items.at(-1)?.id).toBe(replacementId);

      const stale = await postNavigation(updateRequest(persisted.version), {
        params: Promise.resolve({}),
      });
      expect(stale.status).toBe(409);
      expect(
        await prisma.navigationMenu.findUniqueOrThrow({
          where: { id: header.id },
          select: { version: true },
        }),
      ).toEqual({ version: persisted.version + 1 });

      const publicResponse = await publicMenus(
        new Request("http://localhost/api/public/menus"),
      );
      expect(publicResponse.status).toBe(200);
      const publicNavigation = await publicResponse.json();
      expect(JSON.stringify(publicNavigation)).toContain(
        "https://example.test/replacement",
      );
    } finally {
      requestHeaders.mockReset();
    }
  });
});
