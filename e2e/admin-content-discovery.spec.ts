import { expect, test } from "@playwright/test";

const headers = {
  origin: "http://localhost:49201",
  "content-type": "application/json",
};

test("filters content with keyboard navigation and restores filters from browser history", async ({
  page,
}) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const created = await page.request.post("/api/pages", {
    headers,
    data: {
      type: "PAGE",
      layout: "GALLERY",
      title: "Discovery browser gallery",
      slug: "discovery-browser-gallery",
      status: "DRAFT",
    },
  });
  expect(created.status()).toBe(201);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/pages");
  const table = page.getByRole("table", { name: "Pages" });
  const search = page.getByRole("searchbox", { name: "Search", exact: true });
  const type = page.getByLabel("Page type", { exact: true });
  const apply = page.getByRole("button", { name: "Apply filters" });

  await search.fill("browser-gallery");
  await type.selectOption("gallery");
  await apply.press("Enter");
  await expect(page).toHaveURL(/q=browser-gallery.*pageType=gallery/);
  const row = table
    .getByRole("row")
    .filter({ hasText: "Discovery browser gallery" });
  await expect(row).toContainText("Gallery Page");
  await expect(row.locator("time")).toHaveCount(2);

  await page.setViewportSize({ width: 320, height: 640 });
  await page.getByLabel("Status", { exact: true }).selectOption("PUBLISHED");
  await apply.press("Enter");
  await expect(table.getByText("No items found.")).toBeVisible();

  await page.goBack();
  await expect(type).toHaveValue("gallery");
  await expect(
    row.getByRole("link", { name: "Edit Discovery browser gallery" }),
  ).toBeVisible();
  const id = row.getByText("ID", { exact: true });
  await id.press("Enter");
  await expect(row.getByRole("textbox", { name: "Record ID" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Create Page" }),
  ).toBeInViewport();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);

  await page.goForward();
  await expect(table.getByText("No items found.")).toBeVisible();
});
