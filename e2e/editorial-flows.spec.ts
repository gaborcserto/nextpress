import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { OAUTH_PROVIDERS } from "@nextpress/shared/oauth-providers";
import { expect, test, type Request } from "@playwright/test";

const headers = {
  origin: "http://localhost:49201",
  "content-type": "application/json",
};

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
});

test("system appearance, explicit theme and settings/taxonomy navigation", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/admin/taxonomy");
  await expect(
    page.getByRole("heading", { name: "Taxonomy", exact: true }),
  ).toBeVisible();
  const tag = await page.request.post("/api/tags", {
    headers,
    data: { name: "Disposable browser tag" },
  });
  expect(tag.status()).toBe(201);
  await page.reload();
  await expect(
    page.getByText("Disposable browser tag", { exact: true }),
  ).toBeVisible();
  await page.goto("/admin/settings");
  await expect(
    page.getByRole("combobox", { name: "Listing mode" }),
  ).toBeVisible();
});

test("existing page and post forms create and edit content with Slate preserved", async ({
  page,
}) => {
  for (const kind of ["pages", "posts"]) {
    const endpoint = kind === "pages" ? "pages" : "post";
    await page.goto(`/admin/${kind}/new`);
    await page
      .getByRole("textbox", { name: /^Title/ })
      .fill(`Form fixture ${kind}`);
    await page
      .getByRole("textbox", { name: /^Slug/ })
      .fill(`form-fixture-${kind}`);
    await page
      .locator('[contenteditable="true"]')
      .last()
      .pressSequentially("Browser Slate body");
    const createdResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/${endpoint}`) &&
        response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create", exact: true }).click();
    const created = await createdResponse;
    expect(created.status()).toBe(201);
    await expect(page).toHaveURL(new RegExp(`/admin/${kind}$`));
    await page
      .getByRole("link", { name: `Edit Form fixture ${kind}`, exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/admin/${kind}/[^/]+$`));
    const id = new URL(page.url()).pathname.split("/").at(-1);

    if (!id) throw new Error("Missing editorial route identity");
    await page
      .getByRole("textbox", { name: /^Title/ })
      .fill(`Edited form ${kind}`);
    const detailReads: Request[] = [];

    const trackDetailReads = (request: Request) => {
      if (
        request.url().endsWith(`/api/${endpoint}/${id}`) &&
        request.method() === "GET"
      )
        detailReads.push(request);
    };
    page.on("request", trackDetailReads);
    const editedResponse = page.waitForResponse(
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
    expect((await editedResponse).status()).toBe(200);
    await expect(
      page.getByRole("button", {
        name: kind === "pages" ? "Save" : "Save changes",
        exact: true,
      }),
    ).toBeEnabled();
    // A post-save GET could pair a newer remote version with our older Slate form.
    expect(detailReads).toHaveLength(0);
    page.off("request", trackDetailReads);
    await page.reload();
    await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
      `Edited form ${kind}`,
    );
    await expect(page.locator('[contenteditable="true"]').last()).toContainText(
      "Browser Slate body",
    );
    const loaded = await (
      await page.request.get(`/api/${endpoint}/${id}`)
    ).json();
    expect(
      (
        await page.request.put(`/api/${endpoint}/${id}`, {
          headers,
          data: { title: "Missing version" },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await page.request.put(`/api/${endpoint}/${id}`, {
          headers,
          data: {
            title: `Other editor ${kind}`,
            expectedVersion: loaded.item.workingVersion,
          },
        })
      ).status(),
    ).toBe(200);
    await page
      .getByRole("textbox", { name: /^Title/ })
      .fill("Unsaved local changes");
    const conflicted = page.waitForResponse(
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
    expect((await conflicted).status()).toBe(409);
    await expect(page.getByRole("textbox", { name: /^Title/ })).toHaveValue(
      "Unsaved local changes",
    );
    expect(
      (await (await page.request.get(`/api/${endpoint}/${id}`)).json()).item
        .title,
    ).toBe(`Other editor ${kind}`);
    await page.goto(`/admin/${kind}`);
    await page
      .getByRole("button", { name: `Delete Other editor ${kind}`, exact: true })
      .click();
    const deletion = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/${endpoint}/${id}`) &&
        response.request().method() === "DELETE",
    );
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    expect((await deletion).status()).toBe(200);
    await expect(
      page.getByRole("link", {
        name: `Edit Other editor ${kind}`,
        exact: true,
      }),
    ).toHaveCount(0);
  }
});

test("published posts, pagination and load more use real HTTP settings", async ({
  page,
  request,
}) => {
  for (let index = 0; index < 3; index++) {
    const response = await page.request.post("/api/post", {
      headers,
      data: {
        type: "POST",
        status: "PUBLISHED",
        title: `Archive fixture ${index}`,
        slug: `archive-fixture-${index}`,
        tagIds: [],
      },
    });
    expect(response.status()).toBe(201);
    ContentRecordSchema.parse(await response.json());
  }
  const settings = {
    siteName: "Disposable publication",
    siteDescription: "Browser acceptance",
    siteUrl: "http://localhost:49200",
    ogImageUrl: "",
    defaultUserRole: "SUBSCRIBER",
    postListingMode: "PAGINATION",
    postsPerPage: 1,
    oauthProviders: OAUTH_PROVIDERS.map((provider) => ({
      provider,
      enabled: false,
      clientId: "",
    })),
  };
  expect(
    (
      await page.request.put("/api/admin/settings", { headers, data: settings })
    ).status(),
  ).toBe(200);
  await page.goto("http://localhost:49200/posts");
  await expect(page.getByRole("link", { name: /Archive fixture/ })).toHaveCount(
    1,
  );
  await page.getByRole("link", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("link", { name: /Archive fixture/ })).toHaveCount(
    1,
  );
  expect(
    (
      await page.request.put("http://localhost:49201/api/admin/settings", {
        headers,
        data: { ...settings, postListingMode: "LOAD_MORE" },
      })
    ).status(),
  ).toBe(200);
  await page.goto("http://localhost:49200/posts");
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("link", { name: /Archive fixture/ })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("link", { name: /Archive fixture/ })).toHaveCount(
    3,
  );
  const sitemap = await request.get("http://localhost:49200/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain("/posts/archive-fixture-0");
  expect(
    (await request.get("http://localhost:49200/robots.txt")).status(),
  ).toBe(200);
});

test("direct mutation requests reject hostile origins even with an authenticated cookie", async ({
  page,
}) => {
  const response = await page.request.post("http://localhost:49202/api/pages", {
    headers: { ...headers, origin: "https://hostile.invalid" },
    data: {
      type: "PAGE",
      status: "DRAFT",
      slug: "csrf-rejected",
      title: "Rejected",
      tagIds: [],
    },
  });
  expect(response.status()).toBe(403);
});
