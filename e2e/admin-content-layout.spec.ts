import { expect, test, type Page } from "@playwright/test";

const widths = [320, 390, 768, 1024, 1440, 1920];
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

test("Posts and Pages share aligned responsive layouts and link to menu settings", async ({
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
          const records = page.getByRole("table", { name: screen.heading });
          await expect(records).toBeVisible();

          if (width === 390) {
            const record = records
              .getByRole("row")
              .filter({ has: records.getByRole("rowheader") })
              .first();
            await expect(
              record.getByText("Last modified", { exact: true }),
            ).toBeVisible();
            await expect(
              page.getByRole("combobox", { name: "Sort by" }),
            ).toBeVisible();
          }

          const toolbar = await getBounds(
            page,
            ".admin-adaptive-list .admin-list-toolbar",
          );

          const table = await getBounds(page, ".admin-adaptive-list");
          expect(Math.abs(toolbar.left - workspace.left)).toBeLessThanOrEqual(
            1,
          );
          expect(Math.abs(toolbar.right - workspace.right)).toBeLessThanOrEqual(
            1,
          );
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

        if ([390, 768, 1440].includes(width)) {
          await page.screenshot({
            path: `${screenshotDirectory}/${theme.toLowerCase()}-${width}-${screen.name}.png`,
            animations: "disabled",
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
  await expect(
    page.getByRole("heading", { name: "Navigation", exact: true }),
  ).toBeVisible();
  const managePlacement = page.getByRole("link", {
    name: "Manage menu placement",
  });
  await expect(managePlacement).toBeVisible();
  await managePlacement.focus();
  await expect(managePlacement).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/settings\/menus$/);
  await expect(
    page.getByRole("heading", { name: "Menus", exact: true }),
  ).toBeVisible();

  await page.goto("/admin/pages/new");
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page.screenshot({
    path: `${screenshotDirectory}/dark-320-pages-editor-200-percent.png`,
    fullPage: true,
    animations: "disabled",
  });
  await expectNoOverflow(page);

  await page.setViewportSize({ width: 320, height: 370 });
  const openCalendar = page.getByRole("button", { name: "Open calendar" });
  await openCalendar.click();
  const calendar = page.getByRole("dialog");
  await expect(calendar).toBeVisible();
  const dayLabelsFit = await calendar
    .getByRole("group", { name: "Choose day" })
    .getByRole("button")
    .evaluateAll((days) =>
      days.every((day) => {
        const label = document.createRange();
        label.selectNodeContents(day);

        return label.getBoundingClientRect().width <= day.clientWidth;
      }),
    );
  expect(dayLabelsFit).toBe(true);

  const bounds = await calendar.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
  expect(bounds?.y).toBeGreaterThanOrEqual(0);
  expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(370);
  await calendar.getByRole("button", { name: "Previous month" }).focus();
  await page.screenshot({
    path: `${screenshotDirectory}/dark-320-calendar-200-percent.png`,
    animations: "disabled",
    style: "nextjs-portal { display: none; }",
  });
  await page.keyboard.press("Escape");
  await expect(openCalendar).toBeFocused();
});
