import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { EMPTY_RICH_CONTENT } from "@nextpress/shared/content";
import { MediaMetadataSchema } from "@nextpress/shared/media";
import { RevisionRecordSchema } from "@nextpress/shared/revisions";
import { expect, test } from "@playwright/test";
import { execFileSync } from "node:child_process";

const headers = {
  origin: "http://localhost:49201",
  "content-type": "application/json",
};
const password = "Disposable browser passphrase 2026";
test.beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    url.hostname !== "localhost" ||
    url.port !== "55441" ||
    url.pathname !== "/nextpress_e2e"
  )
    throw new Error("Authorization tests require the disposable E2E runner");
});

test("author ownership, publishing rights and direct revision authorization", async ({
  playwright,
}) => {
  const admin = await playwright.request.newContext({
    baseURL: "http://localhost:49201",
  });
  const author = await playwright.request.newContext({
    baseURL: "http://localhost:49201",
  });

  try {
    expect(
      (
        await admin.post("/api/auth/sign-in/email", {
          headers,
          data: { email: "admin@example.invalid", password },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.post("/api/admin/users/create", {
          headers,
          data: {
            email: "author@example.invalid",
            password,
            role: "AUTHOR",
            name: "Disposable Author",
          },
        })
      ).status(),
    ).toBe(201);
    expect(
      (
        await author.post("/api/auth/sign-in/email", {
          headers,
          data: { email: "author@example.invalid", password },
        })
      ).status(),
    ).toBe(200);
    const adminPage = ContentRecordSchema.parse(
      await (
        await admin.post("/api/pages", {
          headers,
          data: {
            type: "PAGE",
            status: "DRAFT",
            title: "Other owner",
            slug: "other-owner",
            tagIds: [],
          },
        })
      ).json(),
    );
    expect(
      (await author.get(`/api/pages/${adminPage.id}/revisions`)).status(),
    ).toBe(404);
    const ownPage = ContentRecordSchema.parse(
      await (
        await author.post("/api/pages", {
          headers,
          data: {
            type: "PAGE",
            status: "DRAFT",
            title: "Author draft",
            slug: "author-draft",
            tagIds: [],
          },
        })
      ).json(),
    );
    const snapshot = {
      expectedVersion: 0,
      title: "Author published",
      slug: ownPage.slug,
      content: EMPTY_RICH_CONTENT,
      excerpt: EMPTY_RICH_CONTENT,
      layout: "STANDARD",
      pageDocument: null,
    };
    const image = {
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
      mime: "image/png",
      alt: "Private owner fixture",
    };
    const privateMedia = MediaMetadataSchema.parse(
      await (await admin.post("/api/media", { headers, data: image })).json(),
    );
    expect((await author.get(`/api/media/${privateMedia.id}`)).status()).toBe(
      404,
    );
    expect(
      (
        await author.delete(`/api/media/${privateMedia.id}`, { headers })
      ).status(),
    ).toBe(403);
    expect(
      (
        await author.post(`/api/pages/${ownPage.id}/revisions`, {
          headers,
          data: {
            ...snapshot,
            pageDocument: {
              version: 1,
              blocks: [
                {
                  id: "stolen",
                  type: "image",
                  version: 1,
                  props: { mediaId: privateMedia.id, alt: "Unauthorized" },
                },
              ],
            },
          },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await author.post(`/api/pages/${ownPage.id}/revisions`, {
          headers: { ...headers, origin: "https://hostile.invalid" },
          data: snapshot,
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await admin.delete(`/api/media/${privateMedia.id}`, { headers })
      ).status(),
    ).toBe(200);
    const results = await Promise.all([
      author.post(`/api/pages/${ownPage.id}/revisions`, {
        headers,
        data: snapshot,
      }),
      author.post(`/api/pages/${ownPage.id}/revisions`, {
        headers,
        data: snapshot,
      }),
    ]);
    expect(results.map((response) => response.status()).sort()).toEqual([
      201, 409,
    ]);
    const saved = results.find((response) => response.status() === 201);

    if (!saved) throw new Error("Missing successful revision");
    const revision = RevisionRecordSchema.parse(await saved.json());
    expect(
      (
        await author.get(
          `/api/pages/${adminPage.id}/revisions?revisionId=${revision.id}`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await author.patch(`/api/pages/${ownPage.id}/revisions`, {
          headers,
          data: {
            expectedVersion: 1,
            revisionId: revision.id,
            action: "publish",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.get(
          `http://localhost:49202/api/public/pages/${ownPage.slug}`,
        )
      ).status(),
    ).toBe(200);
    const secondRevisionResponse = await author.post(
      `/api/pages/${ownPage.id}/revisions`,
      {
        headers,
        data: { ...snapshot, expectedVersion: 2, title: "Second publication" },
      },
    );
    expect(secondRevisionResponse.status()).toBe(201);
    const secondRevision = RevisionRecordSchema.parse(
      await secondRevisionResponse.json(),
    );
    expect(
      (
        await author.patch(`/api/pages/${ownPage.id}/revisions`, {
          headers,
          data: {
            expectedVersion: 3,
            revisionId: secondRevision.id,
            action: "publish",
          },
        })
      ).status(),
    ).toBe(200);
    const restored = await author.patch(`/api/pages/${ownPage.id}/revisions`, {
      headers,
      data: { expectedVersion: 4, revisionId: revision.id, action: "restore" },
    });
    expect(restored.status()).toBe(200);
    expect(await restored.json()).toMatchObject({
      status: "DRAFT",
      title: "Author published",
    });
    const publicPage = await admin.get(
      `http://localhost:49202/api/public/pages/${ownPage.slug}`,
    );
    expect((await publicPage.json()).title).toBe("Second publication");
    expect(
      (
        await author.get(
          `/api/pages/${ownPage.id}/revisions?revisionId=${revision.id}`,
        )
      ).status(),
    ).toBe(200);
    expect(
      (
        await author.get(
          `/api/pages/${ownPage.id}/revisions?revisionId=missing`,
        )
      ).status(),
    ).toBe(404);
    expect(
      (
        await author.patch(`/api/pages/${ownPage.id}/revisions`, {
          headers,
          data: {
            expectedVersion: 5,
            revisionId: revision.id,
            action: "unpublish",
          },
        })
      ).status(),
    ).toBe(200);
    expect(
      (
        await admin.get(
          `http://localhost:49202/api/public/pages/${ownPage.slug}`,
        )
      ).status(),
    ).toBe(404);
    expect([401, 403]).toContain(
      (await author.delete(`/api/pages/${ownPage.id}`, { headers })).status(),
    );
  } finally {
    await admin.dispose();
    await author.dispose();
  }
});

test("expired database session cannot authenticate an admin browser", async ({
  page,
}) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  execFileSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "e2e/expire-session.ts"],
    { stdio: "inherit", timeout: 30_000 },
  );
  await page.goto("/admin");
  await expect(page).toHaveURL(/sign-in/);
  expect((await page.request.get("/api/media")).status()).toBe(401);
  expect(
    (
      await page.request.get("/api/pages/expired/revisions?revisionId=expired")
    ).status(),
  ).toBe(401);
});
