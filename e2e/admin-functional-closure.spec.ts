import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { expect, test } from "@playwright/test";

const publicOrigin = "http://localhost:49200";
const headers = { origin: "http://localhost:49201" };

test.beforeEach(async ({ page }) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
});

test("Slate formatting is visible in both themes and survives publication", async ({
  page,
}) => {
  const created = await page.request.post("/api/pages", {
    headers,
    data: {
      type: "PAGE",
      status: "PUBLISHED",
      title: "Formatting fixture",
      slug: "formatting-fixture",
      tagIds: [],
    },
  });
  expect(created.status()).toBe(201);
  const { id } = ContentRecordSchema.parse(await created.json());

  await page.goto(`/admin/pages/${id}`);
  const editor = page.locator('[contenteditable="true"]').last();
  await editor.click();
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await page.getByRole("button", { name: "Italic", exact: true }).click();
  await page.getByRole("button", { name: "Underline", exact: true }).click();
  await page
    .getByRole("button", { name: "Strikethrough", exact: true })
    .click();
  await page.getByRole("button", { name: "Inline code", exact: true }).click();
  await page.keyboard.insertText("Styled text");
  const marked = editor.locator("strong");
  await expect(marked).toHaveText("Styled text");
  await expect(marked).toHaveCSS("font-weight", "700");
  await expect(editor.locator("em")).toHaveCSS("font-style", "italic");
  await expect(editor.locator("u")).toHaveCSS(
    "text-decoration-line",
    "underline",
  );
  await expect(editor.locator("s")).toHaveCSS(
    "text-decoration-line",
    "line-through",
  );
  await expect(editor.locator("code")).toHaveText("Styled text");

  await page.getByRole("button", { name: "Quote", exact: true }).click();
  await expect(editor.locator("blockquote")).toHaveCSS(
    "border-inline-start-width",
    "4px",
  );
  await page
    .getByRole("button", { name: "Bulleted list", exact: true })
    .click();
  await expect(editor.locator("ul")).toHaveCSS("list-style-type", "disc");
  await expect(editor.locator("ul > li")).toBeVisible();
  await page.getByRole("button", { name: "Heading 2", exact: true }).click();
  await page.getByRole("button", { name: "Align center", exact: true }).click();
  await expect(editor.locator("h2")).toHaveText("Styled text");
  await expect(editor.locator("h2")).toHaveCSS("text-align", "center");
  await expect(editor.locator("ul")).toHaveCount(0);
  expect(
    await editor.locator("h2").evaluate((heading) => {
      const size = Number.parseFloat(getComputedStyle(heading).fontSize);
      const body = heading.closest('[contenteditable="true"]');

      return (
        body !== null &&
        size > Number.parseFloat(getComputedStyle(body).fontSize)
      );
    }),
  ).toBe(true);

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(marked).toHaveCSS("font-weight", "700");
  const save = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/pages/${id}`) &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await save).status()).toBe(200);
  await page.reload();
  await expect(editor.locator("h2 strong")).toHaveText("Styled text");
  await page.goto(`${publicOrigin}/pages/formatting-fixture`);
  await expect(page.locator("article h2 strong")).toHaveText("Styled text");
  await expect(page.locator("article h2 em")).toHaveText("Styled text");
  await expect(page.locator("article h2 s u code")).toHaveText("Styled text");
  await expect(page.locator("article h2")).toHaveCSS("text-align", "center");
});

test("a signed-in user can save their display name and reload it", async ({
  page,
}) => {
  await page.goto("/admin/profile");
  const name = page.getByRole("textbox", { name: "Display name" });
  await name.fill("   ");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Enter a display name.",
  );
  await name.fill("Disposable profile name");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("main").getByRole("status")).toHaveText(
    "Profile saved.",
  );
  await page.getByRole("button", { name: "Open user menu" }).click();
  await expect(page.getByRole("menu", { name: "User menu" })).toContainText(
    "Disposable profile name",
  );
  await page.reload();
  await expect(name).toHaveValue("Disposable profile name");
});

test("Settings selects a persisted Blog variant used by published pages and preview", async ({
  page,
}) => {
  const created = await page.request.post("/api/pages", {
    headers,
    data: {
      type: "PAGE",
      status: "PUBLISHED",
      title: "Appearance fixture",
      slug: "appearance-fixture",
      tagIds: [],
    },
  });
  expect(created.status()).toBe(201);
  const { id } = ContentRecordSchema.parse(await created.json());

  await page.goto("/admin/settings");
  const template = page.getByRole("combobox", { name: "Website template" });
  const variant = page.getByRole("combobox", { name: "Style variant" });
  await expect(template).toHaveValue("blog");
  await expect(variant.locator("option")).toHaveText([
    "Classic",
    "Modern",
    "Minimal",
  ]);
  const siteName = page.getByRole("textbox", { name: "Site name" });
  await siteName.fill("Appearance testing publication");
  const saveSettings = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/admin/settings") &&
      response.request().method() === "PUT",
  );
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  expect((await saveSettings).status()).toBe(200);

  for (const preset of ["modern", "minimal", "classic"]) {
    await variant.selectOption(preset);
    await page.getByRole("button", { name: "Save appearance" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Appearance saved." }),
    ).toBeVisible();
    await page.reload();
    await expect(variant).toHaveValue(preset);
    await expect(siteName).toHaveValue("Appearance testing publication");

    const published = await page.context().newPage();
    await published.goto(`${publicOrigin}/pages/appearance-fixture`);
    await expect(published.locator("html")).toHaveAttribute(
      "data-style-preset",
      preset,
    );

    await page.goto(`/admin/pages/${id}`);
    await page
      .getByRole("button", { name: "Live Preview", exact: true })
      .click();
    const preview = page.frameLocator(
      'iframe[title="Public frontend preview"]',
    );
    await expect(preview.locator("html")).toHaveAttribute(
      "data-style-preset",
      preset,
    );
    const previewHeading = preview.getByRole("heading", {
      name: "Appearance fixture",
      level: 1,
    });
    const publishedHeading = published.getByRole("heading", {
      name: "Appearance fixture",
      level: 1,
    });
    await expect(previewHeading).toHaveCSS(
      "font-family",
      await publishedHeading.evaluate(
        (node) => getComputedStyle(node).fontFamily,
      ),
    );
    await published.close();
    await page.goto("/admin/settings");
  }
});
