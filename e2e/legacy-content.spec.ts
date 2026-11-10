import { expect, test } from "@playwright/test";

import { developmentPages } from "../packages/db/prisma/development-content";

const headers = { origin: "http://localhost:49201" };

test.beforeAll(() => {
  const url = new URL(process.env.DATABASE_URL ?? "");

  if (
    url.hostname !== "localhost" ||
    url.port !== "55441" ||
    url.pathname !== "/nextpress_e2e"
  ) {
    throw new Error("Legacy editor tests require the disposable E2E database");
  }
});

test("upgraded legacy pages and posts open and save without composition or revisions", async ({
  page,
}) => {
  test.setTimeout(120_000);
  expect(
    (
      await page.request.post("/api/auth/sign-in/email", {
        headers,
        data: {
          email: "admin@example.invalid",
          password: "Disposable browser passphrase 2026",
        },
      })
    ).status(),
  ).toBe(200);

  for (const fixture of developmentPages) {
    const endpoint = fixture.type === "PAGE" ? "pages" : "post";
    const response = await page.request.get(`/api/${endpoint}/${fixture.id}`);
    expect(response.status(), fixture.id).toBe(200);
    const { item } = await response.json();
    expect(item).toMatchObject({ title: fixture.title, workingVersion: 0 });
    expect(item.content.length).toBeGreaterThan(0);
  }

  for (const [kind, id] of [
    ["pages", "dev-seed-page-style-guide"],
    ["pages", "legacy-slate-page"],
    ["pages", "legacy-empty-page"],
    ["posts", "legacy-plain-post"],
    ["posts", "dev-seed-post-structured-content"],
  ]) {
    const endpoint = kind === "pages" ? "pages" : "post";
    const before = await (
      await page.request.get(`/api/${endpoint}/${id}`)
    ).json();
    const revisions = await page.request.get(`/api/pages/${id}/revisions`);
    expect(revisions.status()).toBe(200);
    expect(await revisions.json()).toMatchObject({
      version: 0,
      revisions: [],
      current: { pageDocument: null },
    });
    await page.goto(`/admin/${kind}/${id}`);
    await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
      before.item.title,
    );
    await expect(page.locator('[contenteditable="true"]').last()).toBeVisible();
    const title = `Verified ${before.item.title}`;
    await page.getByRole("textbox", { name: /^Title/ }).fill(title);
    const saved = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/${endpoint}/${id}`) &&
        response.request().method() === "PUT",
    );
    await page
      .getByRole("button", {
        name: kind === "pages" ? "Save" : "Save changes",
        exact: true,
      })
      .click();
    expect((await saved).status()).toBe(200);
    await page.reload();
    await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
      title,
    );
    const after = await (
      await page.request.get(`/api/${endpoint}/${id}`)
    ).json();
    expect(after.item).toMatchObject({ title, workingVersion: 1 });
    expect(after.item.content).toEqual(before.item.content);
    if (kind === "posts")
      expect(after.item.excerpt).toEqual(before.item.excerpt);
    expect(
      (
        await page.request.put(`/api/${endpoint}/${id}`, {
          headers,
          data: { title: "Stale overwrite", expectedVersion: 0 },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await page.request.put(`/api/${endpoint}/${id}`, {
          headers,
          data: { title: "Unversioned overwrite" },
        })
      ).status(),
    ).toBe(400);
    const unchangedRevisions = await page.request.get(
      `/api/pages/${id}/revisions`,
    );
    expect(await unchangedRevisions.json()).toMatchObject({
      version: 1,
      revisions: [],
      current: { pageDocument: null },
    });
  }
});
