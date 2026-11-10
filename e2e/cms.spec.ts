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
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.goto("/admin/posts");
  await expect(
    page.getByRole("heading", { name: "Posts", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page).not.toHaveURL(/sign-in/);

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
  await page.goto(`/admin/pages/${record.id}/composition`);
  await expect(page.getByLabel("Working title")).toHaveValue("Browser fixture");
  await page.getByLabel("Upload image").setInputFiles({
    name: "fixture.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved successfully");
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
  await page.getByLabel("Media", { exact: true }).selectOption(asset.id);
  await page.getByRole("button", { name: "Insert image reference" }).click();
  const composition = PageDocumentSchema.parse(
    JSON.parse(await page.getByLabel("Page document JSON").inputValue()),
  );
  await page.getByLabel("Working title").fill("Working revision title");
  await page.getByLabel("Page document JSON").fill(
    JSON.stringify({
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
    }),
  );
  await page
    .getByRole("button", { name: "Save working revision", exact: true })
    .click();
  await expect(page.getByRole("status")).toHaveText("Saved successfully");
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
  await page.getByRole("button", { name: "preview", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Authenticated revision preview" }),
  ).toContainText("Working revision title");
  await page.getByRole("button", { name: "publish", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved successfully");
  await page.getByRole("button", { name: "restore", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Saved successfully");
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
