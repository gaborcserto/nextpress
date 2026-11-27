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
import { waitForRehearsalApp } from "./rehearsal-app-readiness";

import type { WorkingAggregateEnvelope } from "@nextpress/shared/working-aggregate";
import type { ChildProcess } from "node:child_process";

const ownerUrl = process.env.NEXTPRESS_CONTENT_TEST_DATABASE_URL;
const appUrl = process.env.NEXTPRESS_PRIVATE_TEST_DATABASE_URL;
const apiOrigin = "http://localhost:49312";
const adminOrigin = "http://localhost:49311";
const webOrigin = "http://localhost:49310";
const password = "Disposable private rehearsal passphrase 2026";
const email = `private-${randomUUID()}@example.invalid`;
const authorId = `private-${randomUUID()}`;
const tagId = `private-tag-${randomUUID()}`;
const processes: { child: ChildProcess; port: number }[] = [];
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

async function startApp(workspace: "api" | "admin" | "web", port: number) {
  await freePort(port);
  const readinessPath = {
    api: "api/health",
    admin: "auth/sign-in",
    web: "live-preview",
  }[workspace];
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
        NEXT_PUBLIC_PREVIEW_ORIGIN: webOrigin,
        PREVIEW_ADMIN_ORIGIN: adminOrigin,
      },
    },
  );
  processes.push({ child, port });
  await waitForRehearsalApp(child, `http://localhost:${port}/${readinessPath}`);
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
      try {
        for (const { child, port } of processes.reverse()) {
          if (
            !child.pid ||
            child.exitCode !== null ||
            child.signalCode !== null
          ) {
            continue;
          }

          if (process.platform === "win32") {
            try {
              execFileSync(
                "taskkill",
                ["/PID", String(child.pid), "/T", "/F"],
                {
                  stdio: "ignore",
                  windowsHide: true,
                },
              );
            } catch (failure) {
              // The child can exit between the Node status check and taskkill.
              try {
                process.kill(child.pid, 0);
              } catch (probe) {
                if (
                  probe instanceof Error &&
                  "code" in probe &&
                  probe.code === "ESRCH"
                ) {
                  await freePort(port);
                  continue;
                }

                throw probe;
              }

              throw failure;
            }
          } else {
            child.kill("SIGTERM");
          }
        }
      } finally {
        await client?.end();
        await db?.$disconnect();
      }
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
        const resetState = await load(page.id);
        expect(resetState.history).toEqual([
          { version: 2, title: "Public original" },
          { version: 1, title: "Private HTTP title" },
        ]);
        const restoreInput = {
          ...command(resetState),
          operation: "RESTORE",
          restoreVersion: 1,
        };
        const restored = await http(
          `/api/private-drafts/${page.id}`,
          "PUT",
          restoreInput,
        );
        expect(restored.status).toBe(200);
        const restoredBody = await restored.json();
        const recovered =
          WorkingAggregateEnvelopeSchema.parse(restoredBody).aggregate;
        const { savedAt: originalTime, ...originalAggregate } = saved.aggregate;
        const { savedAt: recoveryTime, ...recoveredAggregate } = recovered;
        expect(recoveredAggregate).toEqual(originalAggregate);
        expect(Date.parse(recoveryTime ?? "")).toBeGreaterThanOrEqual(
          Date.parse(originalTime ?? ""),
        );
        expect(
          await (
            await http(`/api/private-drafts/${page.id}`, "PUT", restoreInput)
          ).json(),
        ).toEqual(restoredBody);
        expect(
          await db.nPWorkingRevision.count({ where: { pageId: page.id } }),
        ).toBe(3);
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

    it.each(["PAGE", "POST"] as const)(
      "restores legacy %s through real sessions with replay and access refusal",
      async (kind) => {
        const page = await seed(kind);

        const historical = await db.pageRevision.create({
          data: {
            pageId: page.id,
            title: "HTTP legacy title",
            slug: page.slug,
            content: page.content,
            layout: page.layout,
            status: "DRAFT",
          },
        });
        const input = {
          ...command(await load(page.id)),
          operation: "RESTORE_LEGACY",
          legacyRevisionId: historical.id,
        };
        const path = `/api/private-drafts/${page.id}`;
        expect((await http(path, "PUT", input, "")).status).toBe(401);
        expect(
          (await http(path, "PUT", input, cookie, "https://untrusted.invalid"))
            .status,
        ).toBe(403);
        const accepted = await http(path, "PUT", input);
        expect(accepted.status).toBe(200);
        const result = WorkingAggregateEnvelopeSchema.parse(
          await accepted.json(),
        );
        expect(result.aggregate.snapshot.fields.title).toBe(historical.title);
        expect(await (await http(path, "PUT", input)).json()).toEqual(result);
        expect(
          (await http(path, "PUT", { ...input, legacyRevisionId: "other" }))
            .status,
        ).toBe(409);
        await db.page.update({
          where: { id: page.id },
          data: { authorId: null },
        });
        expect((await http(path, "PUT", input)).status).toBe(404);
        await db.page.update({ where: { id: page.id }, data: { authorId } });
        await db.user.update({
          where: { id: authorId },
          data: { roleId: "b04-subscriber" },
        });

        try {
          expect((await http(path, "PUT", input)).status).toBe(403);
        } finally {
          await db.user.update({
            where: { id: authorId },
            data: { roleId: "b04-author" },
          });
        }

        expect(
          await db.pageRevision.findUnique({ where: { id: historical.id } }),
        ).toEqual(historical);
        const publicResponse = await http(
          `/api/public/${kind === "PAGE" ? "pages" : "posts"}/${page.slug}`,
          "GET",
          undefined,
          "",
        );
        expect(await publicResponse.text()).not.toContain(historical.title);
      },
      60000,
    );

    it("enforces anonymous, CSRF, ownership and current role boundaries through actual sessions", async () => {
      const page = await seed("PAGE");
      const initial = await load(page.id);
      expect(
        (
          await http(
            `/api/private-drafts/${page.id}`,
            "PUT",
            command(initial, { title: "Retained private history" }),
          )
        ).status,
      ).toBe(200);
      const restore = {
        ...command(await load(page.id)),
        operation: "RESTORE",
        restoreVersion: 1,
      };
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
      expect(
        (await http(`/api/private-drafts/${page.id}`, "PUT", restore)).status,
      ).toBe(404);
      await db.user.update({
        where: { id: authorId },
        data: { roleId: "b04-subscriber" },
      });
      expect((await http(`/api/private-drafts/${page.id}`)).status).toBe(403);
      expect(
        (await http(`/api/private-drafts/${page.id}`, "PUT", restore)).status,
      ).toBe(403);
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

    it.each(["PAGE", "POST"] as const)(
      "publishes and manages %s schedules through authenticated HTTP",
      async (kind) => {
        const source = await seed(kind);
        const path = `/api/private-drafts/${source.id}`;
        const publicPath = `/api/public/${kind === "PAGE" ? "pages" : "posts"}/${source.slug}`;
        expect(
          (
            await http(
              path,
              "PUT",
              command(await load(source.id), { title: "HTTP publication" }),
            )
          ).status,
        ).toBe(200);
        const publish = {
          ...command(await load(source.id)),
          operation: "PUBLISH",
        };
        expect((await http(path, "PUT", publish, "")).status).toBe(401);
        expect(
          (
            await http(
              path,
              "PUT",
              publish,
              cookie,
              "https://untrusted.invalid",
            )
          ).status,
        ).toBe(403);
        const accepted = await http(path, "PUT", publish);
        expect(accepted.status).toBe(200);
        const receipt = await accepted.json();
        expect(await (await http(path, "PUT", publish)).json()).toEqual(
          receipt,
        );
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: source.id } })).title,
        ).toBe("HTTP publication");
        expect(
          await (await http(publicPath, "GET", undefined, "")).json(),
        ).toMatchObject({ title: "HTTP publication" });

        for (const operation of [
          "SCHEDULE",
          "SCHEDULE",
          "CANCEL_SCHEDULE",
          "UNPUBLISH",
          "PUBLISH",
        ] as const) {
          const request = {
            ...command(await load(source.id)),
            operation,
            ...(operation === "SCHEDULE"
              ? { scheduledFor: new Date(Date.now() + 60000).toISOString() }
              : {}),
          };
          const response = await http(path, "PUT", request);
          expect(response.status).toBe(200);
          expect((await http(publicPath, "GET", undefined, "")).status).toBe(
            operation === "UNPUBLISH" ? 404 : 200,
          );
        }

        expect(
          (await http("/api/private-drafts/execute", "POST", {})).status,
        ).toBe(403);
        expect(
          (
            await http(path, "PUT", {
              ...command(await load(source.id)),
              operation: "EXECUTE",
            })
          ).status,
        ).toBe(409);
        expect((await load(source.id)).aggregate.release?.state).toBe(
          "CANCELLED",
        );
      },
    );

    it("executes a due release through the secured ADMIN HTTP entry point", async () => {
      await db.user.update({
        where: { id: authorId },
        data: { roleId: "b04-admin" },
      });

      try {
        const source = await seed("PAGE");
        const path = `/api/private-drafts/${source.id}`;
        expect(
          (
            await http(
              path,
              "PUT",
              command(await load(source.id), { title: "Scheduled HTTP" }),
            )
          ).status,
        ).toBe(200);
        expect(
          (
            await http(path, "PUT", {
              ...command(await load(source.id)),
              operation: "SCHEDULE",
              scheduledFor: new Date(Date.now() + 1000).toISOString(),
            })
          ).status,
        ).toBe(200);
        await new Promise((done) => setTimeout(done, 1100));
        const response = await http("/api/private-drafts/execute", "POST", {});
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          results: expect.arrayContaining([
            { pageId: source.id, outcome: "executed" },
          ]),
        });
        const executed = await db.page.findUniqueOrThrow({
          where: { id: source.id },
        });
        expect(executed.title).toBe("Scheduled HTTP");
        expect(
          (await http("/api/private-drafts/execute", "POST", {})).status,
        ).toBe(200);
        expect(
          await db.page.findUniqueOrThrow({ where: { id: source.id } }),
        ).toEqual(executed);
      } finally {
        await db.user.update({
          where: { id: authorId },
          data: { roleId: "b04-author" },
        });
      }
    }, 30000);

    it("runs authenticated Page and Post autosave/reload/discard browser flows against the non-owner API", async () => {
      await startApp("admin", 49311);
      const browser = await chromium.launch({ headless: true });

      try {
        const context = await browser.newContext();
        const page = await context.newPage();
        page.setDefaultTimeout(20_000);
        const rememberedEmail = "remembered@example.invalid";
        await page.addInitScript(
          ({ origin, remembered }) => {
            if (location.origin === origin) {
              localStorage.setItem(
                "nextpress.admin.remembered-email",
                remembered,
              );
            }
          },
          { origin: adminOrigin, remembered: rememberedEmail },
        );

        await page.goto(`${adminOrigin}/auth/sign-in`);
        const emailInput = page.getByLabel("Email", { exact: true });
        // The server renders an empty value. The remembered email appears after hydration.
        await browserExpect(emailInput).toHaveValue(rememberedEmail, {
          timeout: 20_000,
        });
        await emailInput.fill(email);
        await page.getByLabel("Password", { exact: true }).fill(password);
        const signIn = page.getByRole("button", {
          name: "Sign in",
          exact: true,
        });

        const [signInResponse] = await Promise.all([
          page.waitForResponse(
            (response) =>
              response.url() === `${adminOrigin}/api/auth/sign-in/email` &&
              response.request().method() === "POST",
          ),
          signIn.click(),
        ]);

        expect(signInResponse.status()).toBe(200);
        await page.waitForURL(`${adminOrigin}/admin`);

        for (const kind of ["PAGE", "POST"] as const) {
          await page.setViewportSize(
            kind === "PAGE"
              ? { width: 1280, height: 800 }
              : { width: 390, height: 844 },
          );
          const source = await seed(kind);

          const legacy = await db.pageRevision.create({
            data: {
              pageId: source.id,
              title: `Legacy browser ${kind}`,
              slug: source.slug,
              content: source.content,
              layout: source.layout,
              workingVersion: 1,
              status: "DRAFT",
            },
          });

          await page.goto(
            `${adminOrigin}/admin/${kind === "PAGE" ? "pages" : "posts"}/${source.id}`,
            { waitUntil: "commit" },
          );
          await page
            .getByRole("region", { name: "Private draft" })
            .waitFor({ state: "visible" });
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
          const recovery = page.getByRole("region", {
            name: "Recover private draft",
          });
          await browserExpect(recovery.locator("time")).toBeVisible();
          await recovery
            .getByRole("button", { name: "Recover private draft" })
            .click();
          await browserExpect(
            page.getByLabel("Title", { exact: true }),
          ).toHaveValue(`Browser private ${kind}`);
          await page.reload();
          await recovery
            .getByRole("button", { name: "Discard recovery draft" })
            .click();
          await browserExpect(page.getByRole("dialog")).toContainText(
            "immutable historical storage",
          );
          await page
            .getByRole("dialog")
            .getByRole("button", {
              name: "Discard recovery draft",
              exact: true,
            })
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
          await page
            .getByText("Draft recovery and history", { exact: true })
            .click();
          await page
            .getByLabel("Private revision history (latest 100 at load)")
            .selectOption("1");
          await page
            .getByRole("button", { name: "Restore to Draft", exact: true })
            .click();
          await browserExpect(page.getByRole("dialog")).toContainText(
            "Public content and publication dates are unchanged",
          );
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(
            page.getByLabel("Title", { exact: true }),
          ).toHaveValue(`Browser private ${kind}`);
          expect(
            await db.page.findUnique({ where: { id: source.id } }),
          ).toEqual(source);
          expect(
            await db.nPWorkingRevision.count({ where: { pageId: source.id } }),
          ).toBe(3);
          await page
            .getByText("Draft recovery and history", { exact: true })
            .click();
          await page
            .getByLabel("Supported legacy history (from latest 100 at load)")
            .selectOption(legacy.id);
          await page
            .getByRole("button", {
              name: "Restore Legacy to Draft",
              exact: true,
            })
            .click();
          await browserExpect(page.getByRole("dialog")).toContainText(
            "legacy history did not record them",
          );
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(
            page.getByLabel("Title", { exact: true }),
          ).toHaveValue(legacy.title);
          expect(
            await db.page.findUnique({ where: { id: source.id } }),
          ).toEqual(source);
          expect(
            await db.pageRevision.findUnique({ where: { id: legacy.id } }),
          ).toEqual(legacy);
          expect(
            await db.nPWorkingRevision.count({ where: { pageId: source.id } }),
          ).toBe(4);
          await page
            .getByRole("button", { name: "Publish Changes", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(
            page.getByText("Private content matches the public source"),
          ).toBeVisible();
          expect(
            (await db.page.findUniqueOrThrow({ where: { id: source.id } }))
              .title,
          ).toBe(legacy.title);
          await page.getByText("Schedule publication", { exact: true }).click();
          const scheduleDateTime = page
            .getByRole("region", { name: "Private draft" })
            .getByRole("textbox", {
              name: "Publish date and Publish time",
            });
          await scheduleDateTime.fill("2099-01-01 12:00");
          await scheduleDateTime.press("Enter");
          await page
            .getByRole("button", { name: "Schedule", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          const releaseSummary = page.locator("#private-release-summary");
          await browserExpect(releaseSummary).toContainText("PENDING");
          await browserExpect(
            page.getByRole("button", { name: "Publish Changes", exact: true }),
          ).toBeEnabled();
          await scheduleDateTime.fill("2099-01-02 12:00");
          await scheduleDateTime.press("Enter");
          await page
            .getByRole("button", { name: "Reschedule", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(releaseSummary).toContainText("PENDING");
          await browserExpect(releaseSummary.locator("time")).toHaveAttribute(
            "datetime",
            "2099-01-02T12:00:00.000Z",
          );
          await page
            .getByRole("button", { name: "Cancel Schedule", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(releaseSummary).toContainText("CANCELLED");
          await page
            .getByRole("button", { name: "Unpublish", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(
            page.getByRole("button", { name: "Publish", exact: true }),
          ).toBeEnabled();
          expect(
            (await db.page.findUniqueOrThrow({ where: { id: source.id } }))
              .status,
          ).toBe("DRAFT");
          await page
            .getByRole("button", { name: "Publish", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await browserExpect(
            page.getByRole("button", { name: "Publish Changes", exact: true }),
          ).toBeEnabled();

          if (kind === "PAGE") {
            const staleTab = await context.newPage();
            await staleTab.goto(page.url(), { waitUntil: "domcontentloaded" });
            const staleTitle = staleTab.getByLabel("Title", { exact: true });
            await browserExpect(staleTitle).toHaveValue(legacy.title);

            await page.getByLabel("Title", { exact: true }).fill("Winning tab");
            await browserExpect(
              page.getByText(/Private draft saved.*revision 11/),
            ).toBeVisible();
            await staleTitle.fill("Stale tab local edit");
            await browserExpect(
              staleTab
                .getByRole("status")
                .filter({ hasText: "newer private draft" }),
            ).toBeVisible();
            await browserExpect(staleTitle).toHaveValue("Stale tab local edit");
            await staleTab
              .getByRole("button", { name: "Reload private draft" })
              .click();
            await staleTab
              .getByRole("dialog")
              .getByRole("button", { name: "Confirm", exact: true })
              .click();
            await staleTab
              .getByRole("button", { name: "Recover private draft" })
              .click();
            await browserExpect(staleTitle).toHaveValue("Winning tab");
            await staleTab.close();
          }
        }

        await startApp("web", 49310);
        const previewPage = await db.page.create({
          data: {
            type: "PAGE",
            layout: "STANDARD",
            title: "Preview saved title",
            slug: "preview-draft-only",
            content: "Preview editorial introduction",
            authorId,
            status: "DRAFT",
          },
        });
        const editorUrl = `${adminOrigin}/admin/pages/${previewPage.id}`;
        const frame = page.frameLocator(
          'iframe[title="Public frontend preview"]',
        );

        for (const preset of ["classic", "modern", "minimal"] as const) {
          const settings = { stylePreset: preset, postsPerPage: 1 };
          await db.siteSettings.upsert({
            where: { id: "default" },
            create: settings,
            update: settings,
          });
          await page.setViewportSize(
            preset === "minimal"
              ? { width: 390, height: 844 }
              : { width: 1440, height: 900 },
          );
          await page.goto(editorUrl);
          const recover = page.getByRole("button", {
            name: "Recover private draft",
          });
          await browserExpect(
            page.getByRole("region", {
              name: /Private draft|Recover private draft/i,
            }),
          ).toBeVisible();

          if (await recover.isVisible()) {
            await recover.click();
          }

          await page
            .getByRole("button", { name: "Live Preview", exact: true })
            .click();

          if (preset === "minimal") {
            await page.getByLabel("Preview language").selectOption("hu");
            await page.getByRole("button", { name: "Show editing" }).click();
          }

          const layoutField = page.getByLabel("Page type", { exact: true });
          const titleField = page.getByLabel("Title", { exact: true });

          for (const layout of [
            "STANDARD",
            "HOME",
            "POSTS",
            "GALLERY",
          ] as const) {
            await browserExpect(
              layoutField.locator(`option[value="${layout}"]`),
              `${preset} preview: ${layout} should be selectable`,
            ).toBeEnabled();
            await layoutField.selectOption(layout);
            const title = `${preset} ${layout} editorial preview`;
            await titleField.fill(title);

            if (preset === "minimal") {
              await page.getByRole("button", { name: "Show preview" }).click();
            }

            await browserExpect(frame.locator("html")).toHaveAttribute(
              "data-style-preset",
              preset,
            );
            await browserExpect(
              frame.getByRole("heading", { name: title }),
            ).toBeVisible();
            await browserExpect(
              frame.getByText("Preview editorial introduction"),
            ).toBeVisible();

            if (layout === "POSTS") {
              await browserExpect(
                frame.locator("[data-blog-posts-archive]"),
              ).toBeVisible();
              await browserExpect(
                frame.locator("[data-blog-posts-archive] a").first(),
              ).toBeVisible();
            }

            if (layout === "GALLERY") {
              await browserExpect(
                frame.getByText(
                  preset === "minimal" ? /Ez a gal/ : /gallery is empty/i,
                ),
              ).toBeVisible();
            }

            if (preset === "minimal") {
              await browserExpect(frame.locator("html")).toHaveAttribute(
                "lang",
                "hu",
              );
              await page.getByRole("button", { name: "Show editing" }).click();
            }
          }
        }

        expect(
          (
            await http(
              "/api/public/pages/preview-draft-only",
              "GET",
              undefined,
              "",
            )
          ).status,
        ).toBe(404);
        expect(
          (await db.page.findUniqueOrThrow({ where: { id: previewPage.id } }))
            .title,
        ).toBe("Preview saved title");
        await context.close();
      } finally {
        await browser.close();
      }
    }, 180000);
  },
);
