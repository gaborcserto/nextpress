import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { textDocument } from "@nextpress/shared/content";
import { MediaMetadataSchema } from "@nextpress/shared/media";
import { PageDocumentSchema } from "@nextpress/shared/page-document";
import { RevisionListSchema } from "@nextpress/shared/revisions";
import { expect, test } from "@playwright/test";

test("disposable editorial publication, public rendering and session lifecycle", async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });
  await page.goto("/admin/posts");
  await expect(
    page.getByRole("heading", { name: "Posts", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });

  const anonymous = await request.post("http://localhost:49202/api/pages", {
    headers: {
      origin: "http://localhost:49201",
      "content-type": "application/json",
    },
    data: {},
  });
  expect(anonymous.status()).toBe(401);
  const cookies = await page.context().cookies();
  const session = cookies.find((cookie) =>
    cookie.name.includes("session_token"),
  );
  expect(session?.httpOnly).toBe(true);
  const headers = {
    origin: "http://localhost:49201",
    "content-type": "application/json",
  };
  const created = await page.request.post("/api/pages", {
    headers,
    data: {
      type: "PAGE",
      status: "DRAFT",
      slug: "browser-fixture",
      title: "Browser fixture",
      tagIds: [],
    },
  });
  expect(created.status()).toBe(201);
  const record = ContentRecordSchema.parse(await created.json());
  expect(
    (
      await request.get(
        "http://localhost:49202/api/public/pages/browser-fixture",
      )
    ).status(),
  ).toBe(404);
  const published = await page.request.put(`/api/pages/${record.id}`, {
    headers,
    data: { status: "PUBLISHED", expectedVersion: 0 },
  });
  expect(published.status()).toBe(200);
  await page.goto(`/admin/pages/${record.id}`);
  await page.getByLabel("Title", { exact: true }).fill("Unsaved preview title");
  await page.getByRole("button", { name: "Live Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Public frontend preview"]');
  await expect(
    preview.getByRole("heading", { name: "Unsaved preview title" }),
  ).toBeVisible({ timeout: 30_000 });
  for (const viewport of ["Tablet", "Mobile", "Desktop"]) {
    await page.getByLabel("Viewport").selectOption({ label: viewport });
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
      "Unsaved preview title",
    );
  }
  await page.getByRole("button", { name: "Close Live Preview" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Unsaved preview title",
  );
  await page.goto(`/admin/pages/${record.id}/revisions`);
  await expect(page.getByLabel("Working title")).toHaveValue("Browser fixture");
  const uploaded = await page.request.post("/api/media", {
    headers,
    data: {
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
      mime: "image/png",
      alt: "fixture.png",
    },
  });
  expect(uploaded.status()).toBe(201);
  const assets = MediaMetadataSchema.array().parse(
    await (await page.request.get("/api/media")).json(),
  );
  const asset = assets[0];
  expect(asset).toBeDefined();
  if (!asset) throw new Error("Missing uploaded fixture");
  expect(
    (
      await request.get(`http://localhost:49202/api/public/media/${asset.id}`)
    ).status(),
  ).toBe(404);
  expect(
    (
      await page.request.post("/api/media", {
        headers,
        data: { data: "YWJjZA==", mime: "image/png", alt: "invalid" },
      })
    ).status(),
  ).toBe(400);
  const composition = PageDocumentSchema.parse({
    version: 1,
    blocks: [
      {
        id: "image",
        type: "image",
        version: 1,
        props: { mediaId: asset.id, alt: "fixture.png" },
      },
    ],
  });
  await page.getByLabel("Working title").fill("Working revision title");
  const legacyDocument = {
    version: 1,
    blocks: [
      ...composition.blocks,
      {
        id: "hero",
        version: 1,
        type: "hero",
        props: { title: "Composed hero", description: "Portable content" },
      },
      {
        id: "rich",
        version: 1,
        type: "rich-text",
        props: { document: textDocument("Composed rich text") },
      },
      {
        id: "columns",
        version: 1,
        type: "columns",
        props: {},
        regions: [
          [
            {
              id: "cta",
              version: 1,
              type: "call-to-action",
              props: { label: "Read archive", href: "/posts" },
            },
          ],
          [
            {
              id: "column-text",
              version: 1,
              type: "rich-text",
              props: { document: textDocument("Column content") },
            },
          ],
        ],
      },
      {
        id: "listing",
        version: 1,
        type: "content-listing",
        props: { kind: "PAGE", limit: 5 },
      },
    ],
  };
  const revisionSave = await page.request.post(
    `/api/pages/${record.id}/revisions`,
    {
      headers,
      data: {
        expectedVersion: 1,
        title: "Working revision title",
        slug: record.slug,
        layout: "STANDARD",
        content: JSON.stringify(textDocument("Revision body")),
        excerpt: JSON.stringify(textDocument("")),
        pageDocument: legacyDocument,
      },
    },
  );
  expect(revisionSave.ok()).toBe(true);
  await page.reload();
  const working = RevisionListSchema.parse(
    await (await page.request.get(`/api/pages/${record.id}/revisions`)).json(),
  );
  expect(working.revisions).toHaveLength(1);
  expect(
    (
      await (
        await request.get(
          "http://localhost:49202/api/public/pages/browser-fixture",
        )
      ).json()
    ).title,
  ).toBe("Browser fixture");
  const stale = await page.request.patch(`/api/pages/${record.id}/revisions`, {
    headers,
    data: {
      action: "publish",
      expectedVersion: 0,
      revisionId: working.revisions[0]?.id,
    },
  });
  expect(stale.status()).toBe(409);
  expect(
    (
      await request.get(
        `http://localhost:49202/api/pages/${record.id}/revisions?revisionId=${working.revisions[0]?.id}`,
      )
    ).status(),
  ).toBe(401);
  await page
    .getByRole("button", { name: "Preview revision", exact: true })
    .click();
  await expect(
    page
      .frameLocator('iframe[title="Public frontend preview"]')
      .locator("article"),
  ).toContainText("Working revision title");
  await page
    .getByRole("button", { name: "Publish revision", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toHaveText(
    "Revision published.",
  );
  await page
    .getByRole("button", { name: "Restore revision", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toHaveText(
    "Revision restored as a new draft.",
  );
  await page.goto("http://localhost:49200/pages/browser-fixture");
  await expect(
    page.getByRole("heading", { name: "Working revision title", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Composed hero" }),
  ).toBeVisible();
  await expect(page.getByAltText("fixture.png")).toBeVisible();
  await expect(
    page.getByText("Composed rich text", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Column content", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read archive" }),
  ).toHaveAttribute("href", "/posts");
  expect(
    (
      await request.get(`http://localhost:49202/api/public/media/${asset.id}`)
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.delete(
        `http://localhost:49201/api/media/${asset.id}`,
        { headers },
      )
    ).status(),
  ).toBe(409);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "http://localhost:49200/pages/browser-fixture",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:49200");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  await page.goto("http://localhost:49200/pages/nonexistent-browser-fixture");
  await expect(
    page.getByRole("heading", { name: /not found|unavailable/i }),
  ).toBeVisible();
  expect(
    (
      await page.request.delete(
        `http://localhost:49201/api/pages/${record.id}`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.delete(
        `http://localhost:49201/api/media/${asset.id}`,
        { headers },
      )
    ).status(),
  ).toBe(200);
  await page.goto("http://localhost:49201/admin");
  await page.getByRole("button", { name: "Open user menu" }).click();
  await page.getByText("Sign out", { exact: true }).click();
  await expect(page).toHaveURL(/sign-in/);
});
