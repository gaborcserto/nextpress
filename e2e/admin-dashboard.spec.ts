import {
  ContentRecordSchema,
  DashboardSummarySchema,
} from "@nextpress/shared/api-contracts";
import { expect, test, type APIRequestContext } from "@playwright/test";

const origin = "http://localhost:49201";
const api = "http://localhost:49202/api/admin/dashboard";
const password = "Disposable browser passphrase 2026";
const headers = { origin };

test.beforeAll(() => {
  const database = new URL(process.env.DATABASE_URL ?? "");

  if (
    database.host !== "localhost:55441" ||
    database.pathname !== "/nextpress_e2e"
  ) {
    throw new Error("Dashboard tests require the disposable E2E runner");
  }
});

async function signIn(
  request: APIRequestContext,
  email = "admin@example.invalid",
) {
  const response = await request.post("/api/auth/sign-in/email", {
    headers,
    data: { email, password },
  });
  expect(response.status()).toBe(200);
}

async function readDashboard(request: APIRequestContext) {
  const response = await request.get(api);
  expect(response.status()).toBe(200);
  // Next.js development responses normalize the header to no-store.
  expect(response.headers()["cache-control"]).toMatch(
    /(?:^|,\s*)no-store(?:,|$)/,
  );
  const body: unknown = await response.json();
  const dashboard = DashboardSummarySchema.parse(body);
  expect(body).toEqual(dashboard);

  return dashboard;
}

async function createContent(
  request: APIRequestContext,
  type: "POST" | "PAGE",
  title: string,
  status: "DRAFT" | "PUBLISHED",
  publishedAt?: string,
) {
  const response = await request.post(
    type === "PAGE" ? "/api/pages" : "/api/post",
    {
      headers,
      data: { type, status, title, slug: crypto.randomUUID(), publishedAt },
    },
  );
  expect(response.status()).toBe(201);

  return ContentRecordSchema.parse(await response.json());
}

test("aggregates both content types and opens scheduled and recent editors in Chromium", async ({
  page,
}) => {
  await signIn(page.request);
  const before = await readDashboard(page.request);

  const later = await createContent(
    page.request,
    "POST",
    "Later scheduled post",
    "PUBLISHED",
    "2099-01-02T09:00:00Z",
  );

  const earlier = await createContent(
    page.request,
    "PAGE",
    "Earlier scheduled page",
    "PUBLISHED",
    "2099-01-01T09:00:00Z",
  );

  const live = await createContent(
    page.request,
    "PAGE",
    "Reached legacy publication date",
    "PUBLISHED",
    "2000-01-01T09:00:00Z",
  );

  const draft = await createContent(
    page.request,
    "POST",
    "Recently edited draft",
    "DRAFT",
    "2099-01-01T09:00:00Z",
  );

  const summary = await readDashboard(page.request);

  expect(summary.posts).toEqual({
    total: before.posts.total + 2,
    published: before.posts.published,
  });
  expect(summary.pages).toEqual({
    total: before.pages.total + 2,
    published: before.pages.published + 1,
  });
  expect(summary.drafts).toBe(before.drafts + 1);
  expect(summary.scheduled).toBe(before.scheduled + 2);
  expect(
    summary.scheduledContent
      .filter(({ id }) => id === earlier.id || id === later.id)
      .map(({ id }) => id),
  ).toEqual([earlier.id, later.id]);
  expect(
    summary.recentContent
      .slice(0, 4)
      .map(({ id, publicationState }) => [id, publicationState]),
  ).toEqual([
    [draft.id, "DRAFT"],
    [live.id, "PUBLISHED"],
    [earlier.id, "SCHEDULED"],
    [later.id, "SCHEDULED"],
  ]);
  expect(summary.recentContent[0]?.updatedAt).toBe(draft.updatedAt);

  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin");
  const theme = page.getByRole("button", { name: /^Theme:/ });
  await theme.click();
  await page.getByRole("menuitemradio", { name: "Light", exact: true }).click();
  const schedule = page.getByRole("region", { name: "Scheduled publications" });
  const recent = page.getByRole("region", { name: "Recently updated content" });
  const scheduledLink = schedule.getByRole("link", {
    name: /Earlier scheduled page/,
  });
  await expect(scheduledLink).toHaveAttribute(
    "href",
    `/admin/pages/${earlier.id}`,
  );
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("menuitem", { name: "Create Post" }).click();
  await expect(page).toHaveURL("/admin/posts/new");
  await page.goto("/admin");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await scheduledLink.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(scheduledLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(`/admin/pages/${earlier.id}`);

  await page.emulateMedia({ colorScheme: "dark" });
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/admin");
  await theme.click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(scheduledLink).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  const recentLink = recent.getByRole("link", {
    name: /Recently edited draft/,
  });
  await recentLink.click();
  await expect(page).toHaveURL(`/admin/posts/${draft.id}`);
});

test("requires an editorial role and keeps other owners' drafts out of author summaries", async ({
  page,
  request,
}) => {
  expect((await request.get(api)).status()).toBe(401);
  await signIn(request);
  const foreignDraft = await createContent(
    request,
    "PAGE",
    "Private dashboard fixture",
    "DRAFT",
  );
  const email = `dashboard-${crypto.randomUUID()}@example.invalid`;
  const created = await request.post("/api/admin/users/create", {
    headers,
    data: { email, password, role: "AUTHOR", name: "Dashboard Author" },
  });
  expect(created.status()).toBe(201);
  await signIn(page.request, email);
  const empty = await readDashboard(page.request);
  expect(empty).toEqual({
    posts: { total: 0, published: 0 },
    pages: { total: 0, published: 0 },
    drafts: 0,
    scheduled: 0,
    missingPublicationDate: 0,
    recentContent: [],
    scheduledContent: [],
  });
  const own = await createContent(
    page.request,
    "POST",
    "Owned dashboard draft",
    "DRAFT",
  );

  const summary = await readDashboard(page.request);
  expect(summary.recentContent.map(({ id }) => id)).toEqual([own.id]);
  expect(summary.recentContent.map(({ id }) => id)).not.toContain(
    foreignDraft.id,
  );

  const subscriberEmail = `dashboard-${crypto.randomUUID()}@example.invalid`;
  const subscriber = await request.post("/api/admin/users/create", {
    headers,
    data: {
      email: subscriberEmail,
      password,
      role: "SUBSCRIBER",
      name: "Dashboard Subscriber",
    },
  });
  expect(subscriber.status()).toBe(201);
  await page.context().clearCookies();
  await signIn(page.request, subscriberEmail);
  const forbidden = await page.request.get(api);
  expect(forbidden.status()).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "Forbidden" });

  await page.goto("/admin");
  await expect(
    page.getByText(/Editorial summaries are available/),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Post" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Create Page" })).toHaveCount(0);
});
