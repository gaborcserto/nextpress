import {
  ContentRecordSchema,
  TagSchema,
} from "@nextpress/shared/api-contracts";
import { pageLayouts } from "@nextpress/shared/content";
import { OAUTH_PROVIDERS } from "@nextpress/shared/oauth-providers";
import { expect, test, type Page } from "@playwright/test";

const web = "http://localhost:49200";
const api = "http://localhost:49202";
const headers = {
  origin: "http://localhost:49201",
  "content-type": "application/json",
};

async function signIn(page: Page) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });
}

test("edits page types and routes only the eligible homepage", async ({
  page,
  request,
}) => {
  await signIn(page);

  const home = {
    type: "PAGE",
    title: "Browser Home",
    slug: "browser-home",
    layout: pageLayouts.home,
  };
  const create = await page.request.post("/api/pages", {
    headers,
    data: { ...home, status: "DRAFT" },
  });
  expect(create.status()).toBe(201);
  const record = ContentRecordSchema.parse(await create.json());

  expect((await request.get(`${api}/api/public/home`)).status()).toBe(404);
  await page.goto(`${web}/en`);
  await expect(
    page.getByRole("heading", { name: "Latest from the publication" }),
  ).toBeVisible();

  await page.goto(`/admin/pages/${record.id}`);
  await expect(page.getByLabel("Page type")).toHaveValue(pageLayouts.home);
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Page updated.", { exact: true })).toBeVisible();

  await page.goto(`${web}/en`);
  await expect(page.getByRole("heading", { name: home.title })).toBeVisible();
  await page.goto(`${web}/en/pages/${home.slug}`);
  await expect(page.getByRole("heading", { name: home.title })).toBeVisible();

  const anonymous = await request.post(`${api}/api/pages`, {
    headers,
    data: { ...home, slug: "anonymous-browser-home", status: "PUBLISHED" },
  });
  expect(anonymous.status()).toBe(401);

  const conflict = await page.request.post("/api/pages", {
    headers,
    data: { ...home, slug: "second-browser-home", status: "PUBLISHED" },
  });
  expect(conflict.status()).toBe(409);
  expect(await conflict.json()).toEqual({
    error: expect.stringContaining("Home page already exists"),
  });

  const withdrawal = await page.request.put(`/api/pages/${record.id}`, {
    headers,
    data: { status: "DRAFT", expectedVersion: record.workingVersion + 1 },
  });
  expect(withdrawal.status()).toBe(200);
  expect((await request.get(`${api}/api/public/home`)).status()).toBe(404);

  const scheduled = await page.request.post("/api/pages", {
    headers,
    data: {
      ...home,
      slug: "scheduled-browser-home",
      status: "PUBLISHED",
      publishedAt: "2099-11-20T12:00:00Z",
    },
  });
  expect(scheduled.status()).toBe(201);
  expect((await request.get(`${api}/api/public/home`)).status()).toBe(404);

  await page.goto(`/admin/pages/${record.id}`);
  await page.getByLabel("Page type").selectOption(pageLayouts.gallery);
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Page updated.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Page type")).toHaveValue(pageLayouts.gallery);

  await page.goto(`${web}/en/pages/${home.slug}`);
  await expect(page.getByText("This gallery is empty.")).toBeVisible();
});

test("saves a Posts page tag filter and paginates matching published posts", async ({
  page,
}) => {
  await signIn(page);

  const tagResponse = await page.request.post("/api/tags", {
    headers,
    data: { name: "Browser listing tag" },
  });
  expect(tagResponse.ok()).toBe(true);
  const { id: tagId } = TagSchema.parse(await tagResponse.json());

  for (const fixture of [
    {
      title: "Matching entry one",
      slug: "matching-entry-one",
      status: "PUBLISHED",
      tagIds: [tagId],
    },
    {
      title: "Matching entry two",
      slug: "matching-entry-two",
      status: "PUBLISHED",
      tagIds: [tagId],
    },
    {
      title: "Excluded tagged draft",
      slug: "excluded-tagged-draft",
      status: "DRAFT",
      tagIds: [tagId],
    },
    {
      title: "Excluded untagged post",
      slug: "excluded-untagged-post",
      status: "PUBLISHED",
      tagIds: [],
    },
  ]) {
    const response = await page.request.post("/api/post", {
      headers,
      data: { type: "POST", ...fixture },
    });
    expect(response.status()).toBe(201);
  }

  const settings = await page.request.put("/api/admin/settings", {
    headers,
    data: {
      siteName: "Disposable publication",
      siteDescription: "Browser page type acceptance",
      siteUrl: web,
      ogImageUrl: "",
      defaultUserRole: "SUBSCRIBER",
      postListingMode: "PAGINATION",
      postsPerPage: 1,
      oauthProviders: OAUTH_PROVIDERS.map((provider) => ({
        provider,
        enabled: false,
        clientId: "",
      })),
    },
  });
  expect(settings.status()).toBe(200);

  await page.goto("/admin/pages/new");
  await page.getByLabel("Title", { exact: true }).fill("Browser Posts Listing");
  await page.getByLabel("Page type").selectOption(pageLayouts.posts);
  await page.getByLabel("Filter by tag").fill("Browser listing tag");
  await page
    .getByRole("button", { name: "Browser listing tag", exact: true })
    .click();
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await page
    .getByRole("button", { name: /^(Create|Save)$/, exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/pages$/);
  await expect(
    page.getByRole("row", { name: /Browser Posts Listing.*Posts Page/ }),
  ).toBeVisible();

  await page.goto(`${web}/en/pages/browser-posts-listing`);
  await expect(
    page.getByRole("heading", { name: "Browser Posts Listing" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Matching entry/ })).toHaveCount(
    1,
  );
  const first = await page
    .getByRole("link", { name: /Matching entry/ })
    .getAttribute("href");
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/\/en\/pages\/browser-posts-listing\?page=2$/);
  await expect(page.getByRole("link", { name: /Matching entry/ })).toHaveCount(
    1,
  );
  await expect(
    page.getByRole("link", { name: /Matching entry/ }),
  ).not.toHaveAttribute("href", first ?? "");
  await expect(page.getByRole("link", { name: "Next page" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Excluded/ })).toHaveCount(0);
});
