import { WorkingAggregateEnvelopeSchema } from "@nextpress/shared/working-aggregate";
import { chromium, expect as browserExpect } from "@playwright/test";
import { hash } from "bcryptjs";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { disposableDatabaseName } from "./disposable-database";
import { verifyDisposableDatabase } from "./docker-database";

import type { WorkingAggregateEnvelope } from "@nextpress/shared/working-aggregate";
import type { ChildProcess } from "node:child_process";

const ownerUrl = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
const appUrl = process.env.NEXTPRESS_PRIVATE_TEST_DATABASE_URL;
const apiOrigin = "http://localhost:49312";
const adminOrigin = "http://localhost:49311";
const password = "Disposable private rehearsal passphrase 2026";
const email = `private-${randomUUID()}@example.invalid`;
const authorId = `private-${randomUUID()}`;
const tagId = `private-tag-${randomUUID()}`;
const processes: ChildProcess[] = [];
let db: typeof import("@nextpress/db/src/client").prisma;
let client: Client;
let cookie = "";

async function freePort(port: number) {
  const server = createServer();
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => server.close(() => done()));
  });
}

async function startApp(workspace: "api" | "admin", port: number) {
  await freePort(port);
  const child = spawn(
    process.execPath,
    [
      resolve("../../node_modules/next/dist/bin/next"),
      "dev",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    {
      cwd: resolve(`../${workspace}`),
      windowsHide: true,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "development",
        NEXTPRESS_E2E: "1",
        DATABASE_URL: appUrl,
        NEXTPRESS_BACKFILL_DATABASE_ROLE: "np_private_app",
        NEXTPRESS_PRIVATE_DRAFT_REHEARSAL: "enabled",
        BETTER_AUTH_URL: adminOrigin,
        NEXT_PUBLIC_BETTER_AUTH_URL: adminOrigin,
        NEXT_PUBLIC_ADMIN_URL: adminOrigin,
        BETTER_AUTH_SECRET: "private-rehearsal-disposable-auth-secret-2026",
        API_INTERNAL_ORIGIN: apiOrigin,
      },
    },
  );
  processes.push(child);
  const deadline = Date.now() + 90000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error("Isolated application exited before readiness");
    }

    try {
      const response = await fetch(
        `http://localhost:${port}/${workspace === "api" ? "api/health" : "auth/sign-in"}`,
        { signal: AbortSignal.timeout(5000) },
      );

      if (response.ok) {
        return;
      }
    } catch {
      // Bounded startup polling; no content operation is retried here.
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error("Isolated application readiness timed out");
}

function http(
  path: string,
  method = "GET",
  body?: unknown,
  session = cookie,
  origin = adminOrigin,
) {
  return fetch(`${apiOrigin}${path}`, {
    method,
    headers: {
      origin,
      ...(session ? { cookie: session } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
}

async function seed(kind: "PAGE" | "POST") {
  return db.page.create({
    data: {
      type: kind,
      title: "Public original",
      slug: `private-http-${randomUUID()}`,
      content: "Historical bytes",
      status: "PUBLISHED",
      publishedAt: new Date("2020-01-01T00:00:00Z"),
      authorId,
      layout: "EVENT_PAGE",
      eventLocation: "Historical location",
      taxonomies: { create: { taxonomyId: tagId } },
      inHeaderMenu: true,
    },
  });
}

async function load(id: string) {
  const response = await http(`/api/private-drafts/${id}`);
  expect(response.status).toBe(200);

  return WorkingAggregateEnvelopeSchema.parse(await response.json());
}

function command(draft: WorkingAggregateEnvelope, patch = {}) {
  return {
    requestId: randomUUID(),
    expectedDraftVersion: draft.version,
    expectedSourceVersion: draft.sourceVersion,
    edit: {
      expectedVersion: draft.aggregate.baseVersion,
      expectedFingerprint: draft.aggregate.baseFingerprint,
      patch,
    },
  };
}

describe.skipIf(!ownerUrl || !appUrl)(
  "non-owner private draft HTTP and browser rehearsal",
  () => {
    beforeAll(async () => {
      const name = disposableDatabaseName(
        ownerUrl,
        process.env.DATABASE_URL,
        "content",
      );
      db = (await import("@nextpress/db/src/client")).prisma;
      await verifyDisposableDatabase(name, db);
      const target = new URL(appUrl ?? "");
      expect(target.pathname).toBe(`/${name}`);
      expect(target.username).toBe("np_private_app");
      client = new Client({ connectionString: appUrl });
      await client.connect();
      const identity = await client.query<{
        role: string;
        owner: boolean;
        privileged: boolean;
      }>(`SELECT current_user AS role,
      has_schema_privilege('public','CREATE') AS owner, (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls) AS privileged
      FROM pg_roles WHERE rolname=current_user`);
      expect(identity.rows).toEqual([
        { role: "np_private_app", owner: false, privileged: false },
      ]);
      await expect(
        client.query('ALTER TABLE "NPWorkingRevision" DISABLE TRIGGER ALL'),
      ).rejects.toMatchObject({ code: "42501" });
      await db.user.create({
        data: {
          id: authorId,
          email,
          name: "Private rehearsal author",
          roleId: "b04-author",
          accounts: {
            create: {
              provider: "credential",
              providerAccountId: authorId,
              password: await hash(password, 12),
            },
          },
        },
      });
      await db.taxonomy.create({
        data: { id: tagId, type: "TAG", name: "Rehearsal tag", slug: tagId },
      });
      await startApp("api", 49312);
      const signIn = await http(
        "/api/auth/sign-in/email",
        "POST",
        { email, password },
        "",
      );
      expect(signIn.status).toBe(200);
      cookie =
        signIn.headers
          .getSetCookie()
          .find((value) => value.startsWith("better-auth.session_token="))
          ?.split(";")[0] ?? "";
      expect(cookie.length).toBeGreaterThan(20);
    }, 120000);

    afterAll(async () => {
      for (const child of processes.reverse()) {
        if (child.pid && child.exitCode === null) {
          if (process.platform === "win32") {
            execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
              stdio: "ignore",
              windowsHide: true,
            });
          } else {
            child.kill("SIGTERM");
          }
        }
      }
      await client?.end();
      await db?.$disconnect();
    }, 30000);

    it.each(["PAGE", "POST"] as const)(
      "saves, recovers, replays and logically resets %s without changing public content",
      async (kind) => {
        const page = await seed(kind);
        const initial = await load(page.id);
        expect(initial.version).toBe(0);
        expect(initial.tagLabels).toEqual([
          { id: tagId, name: "Rehearsal tag", slug: tagId },
        ]);
        const input = command(initial, { title: "Private HTTP title" });
        const first = await http(
          `/api/private-drafts/${page.id}`,
          "PUT",
          input,
        );
        expect(first.status).toBe(200);
        const saved = WorkingAggregateEnvelopeSchema.parse(await first.json());
        expect(first.headers.get("cache-control")).toContain("no-store");
        const publicResponse = await http(
          `/api/public/${kind === "PAGE" ? "pages" : "posts"}/${page.slug}`,
          "GET",
          undefined,
          "",
        );
        expect(publicResponse.status).toBe(200);
        const publicBody = await publicResponse.text();
        expect(publicBody).toContain("Public original");
        expect(publicBody).not.toContain("Private HTTP title");
        expect(saved.aggregate.snapshot.fields.title).toBe(
          "Private HTTP title",
        );
        expect(saved.aggregate.snapshot.fields.eventLocation).toBe(
          "Historical location",
        );
        const replay = await http(
          `/api/private-drafts/${page.id}`,
          "PUT",
          input,
        );
        expect(await replay.json()).toEqual(saved);
        expect((await load(page.id)).aggregate).toEqual(saved.aggregate);
        expect(
          (
            await http(`/api/private-drafts/${page.id}`, "PUT", {
              ...input,
              requestId: randomUUID(),
            })
          ).status,
        ).toBe(409);
        const reset = await http(`/api/private-drafts/${page.id}`, "PUT", {
          ...command(saved),
          operation: "RESET",
        });
        expect(reset.status).toBe(200);
        expect(
          WorkingAggregateEnvelopeSchema.parse(await reset.json()).aggregate
            .snapshot.fields.title,
        ).toBe("Public original");
        expect(
          await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
        ).toBe(2);
        expect(await db.page.findUnique({ where: { id: page.id } })).toEqual(
          page,
        );
        expect(
          await db.contentEditorialState.findUnique({
            where: { pageId: page.id },
          }),
        ).toBeNull();
      },
      60000,
    );

    it("enforces anonymous, CSRF, ownership and current role boundaries through actual sessions", async () => {
      const page = await seed("PAGE");
      expect(
        (await http(`/api/private-drafts/${page.id}`, "GET", undefined, ""))
          .status,
      ).toBe(401);
      expect(
        (
          await http(
            `/api/private-drafts/${page.id}`,
            "PUT",
            {},
            cookie,
            "https://evil.invalid",
          )
        ).status,
      ).toBe(403);
      await db.page.update({
        where: { id: page.id },
        data: { authorId: null },
      });
      expect((await http(`/api/private-drafts/${page.id}`)).status).toBe(404);
      await db.user.update({
        where: { id: authorId },
        data: { roleId: "b04-subscriber" },
      });
      expect((await http(`/api/private-drafts/${page.id}`)).status).toBe(403);
      await db.user.update({
        where: { id: authorId },
        data: { roleId: "b04-author" },
      });
    }, 60000);

    it("detects live-source drift and permits only an explicit CAS reset", async () => {
      const page = await seed("PAGE");
      const initial = await load(page.id);
      expect(
        (
          await http(
            `/api/private-drafts/${page.id}`,
            "PUT",
            command(initial, { title: "Private" }),
          )
        ).status,
      ).toBe(200);
      await db.page.update({
        where: { id: page.id },
        data: { title: "Live changed" },
      });
      const current = await load(page.id);
      const refused = await http(
        `/api/private-drafts/${page.id}`,
        "PUT",
        command(current, { title: "Stale" }),
      );
      expect(refused.status).toBe(409);
      expect(await refused.json()).toMatchObject({
        code: "SOURCE_VERSION_CONFLICT",
      });
      expect(
        (
          await http(`/api/private-drafts/${page.id}`, "PUT", {
            ...command(current),
            expectedSourceVersion: current.currentSourceVersion,
            operation: "RESET",
          })
        ).status,
      ).toBe(200);
    }, 60000);

    it("runs authenticated Page and Post autosave/reload/discard browser flows against the non-owner API", async () => {
      await startApp("admin", 49311);
      const browser = await chromium.launch({ headless: true });

      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.goto(`${adminOrigin}/auth/sign-in`);
        await page.getByLabel("Email", { exact: true }).fill(email);
        await page.getByLabel("Password", { exact: true }).fill(password);
        await page
          .getByRole("button", { name: "Sign in", exact: true })
          .click();
        await browserExpect(page).not.toHaveURL(/sign-in/);

        for (const kind of ["PAGE", "POST"] as const) {
          const source = await seed(kind);
          await page.goto(
            `${adminOrigin}/admin/${kind === "PAGE" ? "pages" : "posts"}/${source.id}`,
          );
          await browserExpect(
            page.getByRole("region", { name: "Private draft" }),
          ).toBeVisible();
          await browserExpect(
            page.getByLabel("Status", { exact: true }),
          ).toBeDisabled();
          await page
            .getByLabel("Title", { exact: true })
            .fill(`Browser private ${kind}`);
          await browserExpect(
            page.getByText(/Private draft saved · revision 1/),
          ).toBeVisible();
          await page.reload();
          await browserExpect(
            page.getByLabel("Title", { exact: true }),
          ).toHaveValue(`Browser private ${kind}`);
          await page
            .getByRole("button", {
              name: "Reset private draft to live source",
              exact: true,
            })
            .click();
          await browserExpect(page.getByRole("dialog")).toContainText(
            "immutable historical storage",
          );
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(
            page.getByLabel("Title", { exact: true }),
          ).toHaveValue("Public original");
          expect(
            await db.page.findUnique({ where: { id: source.id } }),
          ).toEqual(source);
          expect(
            await db.nPWorkingRevision.count({ where: { pageId: source.id } }),
          ).toBe(2);
        }
        await context.close();
      } finally {
        await browser.close();
      }
    }, 180000);
  },
);
