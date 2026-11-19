import { PublicNavigationSchema } from "@nextpress/shared/api-contracts";
import { expect, test, type Page } from "@playwright/test";

const widths = [320, 375, 768, 1024, 1440, 1920];
const screenshotDirectory = ".notes/admin-redesign/screenshots-admin0342";

async function signIn(page: Page) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function selectTheme(page: Page, theme: "Light" | "Dark") {
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(
    overflow,
    `Unexpected overflow at ${page.url()} and ${page.viewportSize()?.width}px`,
  ).toBeLessThanOrEqual(1);
}

async function getBounds(page: Page, selector: string) {
  return await page.locator(selector).evaluate((element) => {
    const rect = element.getBoundingClientRect();

    return { left: rect.left, right: rect.right, width: rect.width };
  });
}

test("Posts and Pages share aligned responsive layouts and preserve menu placement", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);

  const measuredWidths: Record<
    string,
    { left: number; right: number; width: number }
  > = {};

  for (const theme of ["Light", "Dark"] as const) {
    await selectTheme(page, theme);

    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });

      for (const screen of [
        { path: "/admin/posts", name: "posts-list", heading: "Posts" },
        { path: "/admin/pages", name: "pages-list", heading: "Pages" },
        {
          path: "/admin/posts/new",
          name: "posts-editor",
          heading: "Create Post",
        },
        {
          path: "/admin/pages/new",
          name: "pages-editor",
          heading: "Create Page",
        },
      ]) {
        await page.goto(screen.path);
        await expect(
          page.getByRole("heading", {
            name: screen.heading,
            level: 1,
            exact: true,
          }),
        ).toBeVisible();
        await expectNoOverflow(page);

        const workspace = await getBounds(page, ".admin-page");
        const header = await getBounds(page, ".admin-page-header");
        expect(header.left).toBeCloseTo(workspace.left, 0);
        expect(header.right).toBeCloseTo(workspace.right, 0);

        if (screen.name.endsWith("-list")) {
          await expect(page.getByRole("table")).toBeVisible();
          const toolbar = await getBounds(
            page,
            ".admin-page > .admin-list-toolbar",
          );

          const table = await getBounds(
            page,
            ".admin-page > div.overflow-x-auto",
          );
          expect(toolbar.left).toBeCloseTo(workspace.left, 0);
          expect(toolbar.right).toBeCloseTo(workspace.right, 0);
          expect(table.left).toBeCloseTo(workspace.left, 0);
          expect(table.right).toBeCloseTo(workspace.right, 0);
        } else {
          await expect(page.locator(".admin-writing-layout")).toBeVisible();

          if (width >= 1440) {
            const columns = page.locator(".admin-writing-layout > *");
            const main = await columns.nth(0).boundingBox();
            const sidebar = await columns.nth(1).boundingBox();
            expect(sidebar?.x).toBeGreaterThan(main?.x ?? 0);
          }

          if (screen.name === "posts-editor") {
            await expect(
              page.getByRole("checkbox", { name: "Show in header menu" }),
            ).toHaveCount(0);
          }
        }

        if (width >= 1440) {
          measuredWidths[`${width}-${screen.name}`] = workspace;
        }

        if ([320, 1440, 1920].includes(width)) {
          await page.screenshot({
            path: `${screenshotDirectory}/${theme.toLowerCase()}-${width}-${screen.name}.png`,
            style: "nextjs-portal { display: none; }",
          });
        }
      }
    }
  }

  for (const width of [1440, 1920]) {
    expect(measuredWidths[`${width}-posts-list`]).toEqual(
      measuredWidths[`${width}-pages-list`],
    );
    expect(measuredWidths[`${width}-posts-editor`]).toEqual(
      measuredWidths[`${width}-pages-editor`],
    );
  }

  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/admin/pages/new");
  await page.getByLabel("Title").fill("Menu placement browser check");
  await page
    .getByRole("combobox", { name: "Status" })
    .selectOption("PUBLISHED");

  const headerPlacement = page.getByRole("checkbox", {
    name: "Show in header menu",
  });
  const footerPlacement = page.getByRole("checkbox", {
    name: "Show in footer menu",
  });
  await expect(headerPlacement).not.toBeChecked();
  await expect(footerPlacement).not.toBeChecked();
  await headerPlacement.focus();
  await page.keyboard.press("Space");
  await footerPlacement.focus();
  await page.keyboard.press("Space");
  await expect(headerPlacement).toBeChecked();
  await expect(footerPlacement).toBeChecked();
  await expect(
    page.locator('.admin-editor-feedback [role="status"]'),
  ).toContainText("Unsaved changes");

  const createResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/pages" &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await createResponse;
  await expect(page).toHaveURL(/\/admin\/pages$/);

  await page
    .getByRole("link", { name: "Menu placement browser check", exact: true })
    .click();
  await expect(headerPlacement).toBeChecked();
  await expect(footerPlacement).toBeChecked();

  await headerPlacement.focus();
  await page.keyboard.press("Space");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.locator('.admin-editor-feedback [role="status"]'),
  ).toContainText("Saved");
  await expect(headerPlacement).not.toBeChecked();
  await expect(footerPlacement).toBeChecked();

  await page.reload();
  await expect(headerPlacement).not.toBeChecked();
  await expect(footerPlacement).toBeChecked();

  const navigationResponse = await page.request.get(
    "http://localhost:49201/api/public/navigation",
  );
  expect(navigationResponse.ok()).toBe(true);
  const navigation = PublicNavigationSchema.parse(
    await navigationResponse.json(),
  );
  expect(navigation.header).not.toContainEqual({
    slug: "menu-placement-browser-check",
    title: "Menu placement browser check",
  });
  expect(navigation.footer).toContainEqual({
    slug: "menu-placement-browser-check",
    title: "Menu placement browser check",
  });

  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.screenshot({
    path: `${screenshotDirectory}/dark-320-pages-editor-200-percent.png`,
    fullPage: true,
  });
  await expectNoOverflow(page);
});
