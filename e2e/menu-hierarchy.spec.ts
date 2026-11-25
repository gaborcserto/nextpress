import {
  ContentRecordSchema,
  EditorialPageSchema,
  HomepageSelectionSchema,
} from "@nextpress/shared/api-contracts";
import { expect, test, type Page } from "@playwright/test";

const adminHeaders = {
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

async function ensurePublishedHomepage(page: Page) {
  const existingResponse = await page.request.get("/api/pages?select=homepage");
  expect(existingResponse.status()).toBe(200);
  const existing = HomepageSelectionSchema.parse(await existingResponse.json());
  let pageId = existing.id;

  if (!pageId) {
    const createdResponse = await page.request.post("/api/pages", {
      headers: adminHeaders,
      data: {
        type: "PAGE",
        status: "DRAFT",
        slug: "homepage-fixture",
        title: "Published Homepage fixture",
        layout: "HOME",
        tagIds: [],
      },
    });
    expect(createdResponse.status()).toBe(201);
    pageId = ContentRecordSchema.parse(await createdResponse.json()).id;
  }

  const pageResponse = await page.request.get(`/api/pages/${pageId}`);
  expect(pageResponse.status()).toBe(200);
  const detail: unknown = await pageResponse.json();

  const homepage =
    typeof detail === "object" && detail !== null && "item" in detail
      ? EditorialPageSchema.parse(detail.item)
      : null;

  if (!homepage) {
    throw new Error("Homepage details did not include the expected page item");
  }

  if (homepage.status !== "PUBLISHED") {
    const published = await page.request.put(`/api/pages/${pageId}`, {
      headers: adminHeaders,
      data: {
        expectedVersion: homepage.workingVersion,
        status: "PUBLISHED",
      },
    });

    expect(published.status()).toBe(200);
  }
}

test("persists a nested Group relationship on the assigned Header", async ({
  page,
}) => {
  test.setTimeout(90_000);

  await signIn(page);
  await ensurePublishedHomepage(page);
  await page.goto("/admin/settings/menus");
  await expect(
    page.getByRole("heading", { name: "Menus", exact: true }),
  ).toBeVisible();

  const addItems = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Add menu items" }) });
  const homepageOption = addItems
    .locator("label")
    .filter({ hasText: "Published Homepage fixture" });
  await expect(homepageOption.getByText("System page")).toBeVisible();
  await expect(
    homepageOption.getByText("Published", { exact: true }),
  ).toBeVisible();
  await homepageOption.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Add selected", exact: true }).click();

  const homepageRow = page.locator("li[data-menu-item-id]").filter({
    has: page.getByRole("heading", {
      name: "Published Homepage fixture",
      exact: true,
    }),
  });
  await expect(homepageRow.getByText("System page")).toBeVisible();
  await expect(
    homepageRow.getByText("Published", { exact: true }),
  ).toBeVisible();

  const addGroup = page.getByRole("button", { name: "Group", exact: true });
  await addGroup.click();
  const structure = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Menu structure" }) });
  await structure.locator("summary").filter({ hasText: "Group" }).click();
  await structure
    .getByRole("textbox", { name: "Item label" })
    .fill("Parent branch");
  await addGroup.click();
  await structure
    .locator("summary")
    .filter({ hasText: "Group" })
    .last()
    .click();
  await structure
    .getByRole("textbox", { name: "Item label" })
    .last()
    .fill("Child branch");
  const childRow = structure.locator("li").filter({
    has: page.locator("summary").filter({ hasText: "Child branch" }),
  });
  await childRow.getByRole("button", { name: "Indent" }).click();
  const parentRows = structure.locator("li").filter({
    has: page.getByRole("heading", {
      name: "Parent branch",
      exact: true,
    }),
  });

  const parentId = await parentRows.last().getAttribute("data-menu-item-id");

  if (!parentId) {
    throw new Error("Expected the parent group to have a menu item ID");
  }

  await expect(
    childRow.getByRole("combobox", { name: "Parent item" }),
  ).toHaveValue(parentId);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Menu saved.")).toBeVisible();
  await page.reload();
  const reloadedStructure = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Menu structure" }) });
  const reloadedChild = reloadedStructure.locator("li").filter({
    has: page.getByRole("heading", {
      name: "Child branch",
      exact: true,
    }),
  });
  await reloadedChild.locator("summary").click();
  await expect(
    reloadedChild.getByRole("combobox", { name: "Parent item" }),
  ).toHaveValue(parentId);
});

test("saves Header reordering, visibility, removal and replacement", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await signIn(page);
  await ensurePublishedHomepage(page);
  await page.goto("/admin/settings/menus");
  await expect(
    page.getByRole("heading", { name: "Menus", exact: true }),
  ).toBeVisible();

  const header = page.locator("li[data-menu-item-id]");
  await expect(header).not.toHaveCount(0);
  const originalOrder = await header.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-menu-item-id")),
  );
  await header.first().locator("summary").click();
  await header.first().getByRole("button", { name: "Move down" }).click();
  const save = page.getByRole("button", { name: "Save", exact: true });
  const reorderResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/navigation") &&
      response.request().method() === "POST",
  );
  await save.click();
  expect((await reorderResponse).status()).toBe(200);
  await expect(page.getByText("Menu saved.")).toBeVisible();
  await page.reload();
  const reorderedIds = await header.evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-menu-item-id")),
  );
  expect(reorderedIds).not.toEqual(originalOrder);

  await expect(header).not.toHaveCount(0);
  const originalCount = await header.count();
  const search = page.getByRole("searchbox", { name: "Search pages" });

  await search.fill("Contact");
  await page
    .locator("label")
    .filter({ hasText: "Contact" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Add selected", exact: true }).click();
  const contactRow = page.locator("li[data-menu-item-id]").filter({
    has: page.getByRole("heading", { name: "Contact", exact: true }),
  });
  const contactDisclosure = contactRow.locator("details");
  await expect(contactDisclosure).not.toHaveAttribute("open", "");
  await save.click();
  await expect(page.getByText("Menu saved.")).toBeVisible();
  await expect(save).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true }),
  ).toBeVisible();
  const contactAfterReload = page.locator("li[data-menu-item-id]").filter({
    has: page.getByRole("heading", { name: "Contact", exact: true }),
  });
  await expect(
    contactAfterReload.getByRole("button", { name: "Hide menu item" }),
  ).toBeVisible();
  const publicMenus = await page.evaluate(
    async () => (await (await fetch("/api/public/menus")).json()).header,
  );
  expect(
    publicMenus.some(
      (item: { href: string | null }) => item.href === "/contact",
    ),
  ).toBe(true);
  await page.goto("http://localhost:49200/posts");
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Contact", exact: true }),
  ).toBeVisible();

  await page.goto("/admin/settings/menus");
  await contactRow.getByRole("button", { name: "Hide menu item" }).click();
  await save.click();
  await expect(page.getByText("Menu saved.")).toBeVisible();
  const hiddenMenus = await page.evaluate(
    async () => (await (await fetch("/api/public/menus")).json()).header,
  );
  expect(
    hiddenMenus.some(
      (item: { href: string | null }) => item.href === "/contact",
    ),
  ).toBe(false);
  await page.goto("http://localhost:49200/posts");
  await expect(
    page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Contact", exact: true }),
  ).toHaveCount(0);

  await page.goto("/admin/settings/menus");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true }),
  ).toBeVisible();
  await expect(
    contactAfterReload.getByRole("button", { name: "Show menu item" }),
  ).toBeVisible();

  const removeContact = page.locator("li[data-menu-item-id]").filter({
    has: page.getByRole("heading", { name: "Contact", exact: true }),
  });
  await removeContact.locator("summary").click();
  await removeContact.getByRole("button", { name: "Remove item" }).click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText("Menu saved.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true }),
  ).toHaveCount(0);

  const removeExisting = page.locator("li[data-menu-item-id]").filter({
    has: page.getByRole("heading", { name: "About NextPress", exact: true }),
  });
  await removeExisting.locator("summary").click();
  await removeExisting.getByRole("button", { name: "Remove item" }).click();
  await search.fill("Contact");
  await page
    .locator("label")
    .filter({ hasText: "Contact" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "Add selected", exact: true }).click();

  await expect(page.locator("li[data-menu-item-id]")).toHaveCount(
    originalCount,
  );
  await save.click();
  await expect(page.getByText("Menu saved.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "About NextPress", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true }),
  ).toBeVisible();
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "About NextPress", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Contact", exact: true }),
  ).toBeVisible();
});
