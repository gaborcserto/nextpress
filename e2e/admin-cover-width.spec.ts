import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

test("post cover uploader matches the excerpt editor width", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/admin/posts/new");

  const intro = page
    .locator("section.admin-surface")
    .filter({ has: page.getByRole("heading", { name: "Intro" }) });
  const excerpt = intro.getByRole("textbox", { name: "Excerpt (lead)" });
  const dropzone = intro.locator("section.border-dashed");
  await expect(excerpt).toBeVisible();
  await expect(dropzone).toBeVisible();

  const [excerptBox, dropzoneBox] = await Promise.all([
    excerpt.boundingBox(),
    dropzone.boundingBox(),
  ]);

  if (!excerptBox || !dropzoneBox) {
    throw new Error("Post intro editor or cover dropzone is not measurable");
  }

  expect(Math.abs(dropzoneBox.x - excerptBox.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      dropzoneBox.x + dropzoneBox.width - excerptBox.x - excerptBox.width,
    ),
  ).toBeLessThanOrEqual(1);
});
