import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { expect, test, type Page } from "@playwright/test";

const screenshotDirectory = ".notes/ds-01-browser/admin";
const widths = [320, 390, 768, 1024, 1280, 1440, 1920];
const screens = [
  ["", "Dashboard"],
  ["/posts", "Posts"],
  ["/pages", "Pages"],
  ["/users", "Users"],
  ["/taxonomy", "Taxonomy"],
  ["/settings", "Settings"],
  ["/profile", "Profile"],
];

async function signIn(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await expect(
    page.getByRole("status").filter({ hasText: /Welcome,/ }),
  ).toBeVisible();
}

async function selectTheme(page: Page, mode: "Light" | "Dark" | "System") {
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
}

async function screenshot(page: Page, name: string) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );

  await page.screenshot({
    path: `${screenshotDirectory}/${name}.png`,
    style: "nextjs-portal { display: none; }",
  });
}

async function expectNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(
    overflow,
    `Unexpected page overflow at ${page.url()} with width ${page.viewportSize()?.width}`,
  ).toBeLessThanOrEqual(1);
}

test("admin typography, themes and representative layouts reflow in Chromium", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/auth/sign-in");
  const theme = page.getByRole("button", { name: /^Theme:/ });
  await expect(theme).toHaveAccessibleName("Theme: System");
  const root = page.locator("html");
  expect(
    await root.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--color-base-200").trim(),
    ),
  ).toMatch(/^oklch\(23\.26% 0?\.014 253\.1\)$/);
  await expectNoPageOverflow(page);
  await screenshot(page, "sign-in-dark-320");
  await selectTheme(page, "Light");
  await page.reload();
  await expect(theme).toHaveAccessibleName("Theme: Light");
  await expect(root).toHaveCSS("color-scheme", "light");
  await page.setViewportSize({ width: 1440, height: 900 });
  await screenshot(page, "sign-in-light-1440");
  await signIn(page);
  await expect(theme).toHaveAccessibleName("Theme: Light");

  for (const [path, heading] of screens) {
    await page.goto(`/admin${path}`);
    await expect(
      page.getByRole("heading", { name: heading, exact: true, level: 1 }),
    ).toBeVisible();

    if (path === "") {
      await expect(
        page.getByRole("heading", { name: "Recently updated content" }),
      ).toBeVisible();
      await expect(page.getByText("Total Posts")).toBeVisible();
      await expect(page.getByText("Total Pages")).toBeVisible();
    }

    if (["/posts", "/pages", "/users", "/taxonomy"].includes(path)) {
      await expect(page.getByRole("table")).toBeVisible();
    }

    if (["/posts", "/pages", "/taxonomy"].includes(path)) {
      const sort = path === "/taxonomy" ? "slug" : "title";
      const sortBy = page.getByRole("combobox", { name: "Sort by" });
      const direction = page.getByRole("combobox", { name: "Sort direction" });
      await sortBy.selectOption(sort);
      await direction.selectOption("asc");
      await page.getByRole("button", { name: "Apply filters" }).click();
      await expect(page).toHaveURL(
        (url) =>
          url.searchParams.get("sort") === sort &&
          url.searchParams.get("direction") === "asc",
      );
      await expect(sortBy).toHaveValue(sort);
      await expect(direction).toHaveValue("asc");
    }

    if (path === "/users") {
      const created = page.getByRole("columnheader", { name: "Created" });
      const sortButton = created.getByRole("button");
      await expect(created).toHaveAttribute("aria-sort", "descending");
      await sortButton.press("Enter");
      await expect(sortButton).toBeFocused();
      await expect(sortButton).toHaveCSS("outline-style", "solid");
      await expect(created).toHaveAttribute("aria-sort", "ascending");
      await sortButton.press("Space");
      await expect(created).toHaveAttribute("aria-sort", "descending");
    }

    if (path === "/profile") {
      await expect(page.getByLabel("Display name")).toBeVisible();
    }

    if (path === "/settings") {
      await expect(page.getByRole("tab", { name: "General" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(
        page.getByRole("heading", { name: "Website appearance", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "Website template" }),
      ).toBeVisible({ timeout: 25_000 });
    }

    for (const preference of ["light", "dark"]) {
      await selectTheme(page, preference === "light" ? "Light" : "Dark");
      await expect(root).toHaveCSS("color-scheme", preference);

      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoPageOverflow(page);

        if (
          !path ||
          (width === 1440 && preference === "light") ||
          (width === 390 && preference === "dark")
        ) {
          await screenshot(
            page,
            `${heading.toLowerCase()}-${preference}-${width}`,
          );
        }
      }
    }

    if (path === "/settings") {
      await page
        .getByRole("heading", { name: "Website appearance", exact: true })
        .scrollIntoViewIfNeeded();
      await screenshot(page, "appearance-dark-1920");
      await page.getByRole("tab", { name: "Authentication" }).click();
      const github = page.locator("summary").filter({ hasText: /github/i });
      await github.press("Enter");
      await expect(
        page.getByRole("textbox", { name: "github client ID" }),
      ).toBeVisible();
      await screenshot(page, "oauth-dark-1920");
    }

    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(
      () => (document.documentElement.style.fontSize = "200%"),
    );
    await expectNoPageOverflow(page);
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );
  }

  for (const segment of ["posts", "pages"]) {
    await page.goto(`/admin/${segment}/new`);
    await expect(
      page.getByRole("heading", { name: "Document details" }),
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await selectTheme(page, "Light");
    await expectNoPageOverflow(page);
    const writingCanvas = page.locator(
      '[data-slate-editor="true"][aria-label="Content"]',
    );
    await expect(writingCanvas).toBeVisible();
    const canvasBounds = await writingCanvas.boundingBox();
    expect(canvasBounds?.height).toBeGreaterThanOrEqual(240);
    await screenshot(page, `new-${segment}-light-1440`);
    await page.setViewportSize({ width: 390, height: 800 });
    await selectTheme(page, "Dark");
    await expectNoPageOverflow(page);
    await screenshot(page, `new-${segment}-dark-390`);

    for (const mode of ["Light", "Dark"] as const) {
      await selectTheme(page, mode);

      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoPageOverflow(page);
      }
    }

    await page.setViewportSize({ width: 1440, height: 800 });
    await page.evaluate(() =>
      window.scrollTo({ top: 400, behavior: "instant" }),
    );
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    const topbar = page.getByRole("banner");
    await expect(topbar).toHaveCSS("position", "sticky");
    const stickyInset = await topbar.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element).top),
    );
    expect((await topbar.boundingBox())?.y).toBeCloseTo(stickyInset, 0);
    await expect(
      topbar.getByRole("button", { name: "Create", exact: true }),
    ).toBeInViewport();
    await screenshot(page, `scrolled-${segment}-dark-1440`);
    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expect(
      writingCanvas.locator("[data-slate-placeholder]"),
    ).toBeVisible();
    await expectNoPageOverflow(page);
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );
  }

  await selectTheme(page, "System");
  await page.reload();
  await expect(theme).toHaveAccessibleName("Theme: System");
  expect(
    await root.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--color-base-200").trim(),
    ),
  ).toMatch(/^oklch\(23\.26% 0?\.014 253\.1\)$/);
  await page.emulateMedia({ colorScheme: "light" });
  expect(
    await root.evaluate((element) =>
      getComputedStyle(element).getPropertyValue("--color-base-200").trim(),
    ),
  ).toBe("oklch(98% 0 0)");
});

test("mobile overlays and native confirmation support keyboard dismissal and restore focus", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto("/auth/sign-in");
  await signIn(page);

  const navigationTrigger = page.getByRole("button", {
    name: "Open navigation",
  });
  await navigationTrigger.press("Enter");
  const navigation = page.getByRole("dialog", { name: "Admin navigation" });
  await expect(
    navigation.getByRole("button", { name: "Close navigation" }),
  ).toBeFocused();
  await expect(navigation).toHaveCSS("width", "390px");
  await expect(navigation).toHaveCSS("height", "760px");
  await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
  await page
    .getByRole("button", { name: "Open user menu", includeHidden: true })
    .focus();
  await expect(
    navigation.getByRole("button", { name: "Close navigation" }),
  ).toBeFocused();
  await screenshot(page, "navigation-mobile-390");
  const expandedLabel = "Szerepkörök és hozzáférési beállítások";
  await navigation
    .getByRole("link", { name: "Settings" })
    .locator("span")
    .evaluate((label, text) => {
      label.textContent = text;
    }, expandedLabel);
  await expect(
    navigation.getByRole("link", { name: expandedLabel }),
  ).toBeVisible();
  const horizontalOverflow = await navigation.evaluate(
    (dialog) => dialog.scrollWidth - dialog.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(1);

  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(navigationTrigger).toBeFocused();

  const account = page.getByRole("button", { name: "Open user menu" });
  await account.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("menu", { name: "User menu" });
  await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeFocused();
  const topbarWidth = await page
    .locator(".admin-topbar")
    .evaluate((topbar) => topbar.clientWidth);

  const menuBounds = await menu.boundingBox();
  expect(menuBounds?.width).toBeCloseTo(topbarWidth - 16, 0);
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeFocused();
  await screenshot(page, "account-mobile-390");
  await page.keyboard.press("Escape");
  await expect(account).toBeFocused();
  await account.click();
  await page.locator("main").click({ position: { x: 4, y: 4 } });
  await expect(menu).toBeHidden();

  const theme = page.getByRole("button", { name: /^Theme:/ });
  await theme.press("ArrowDown");
  const themeMenu = page.getByRole("menu", { name: "Theme" });
  await expect(
    themeMenu.getByRole("menuitemradio", { name: "Light" }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    themeMenu.getByRole("menuitemradio", { name: "System" }),
  ).toBeFocused();
  await expect(
    themeMenu.getByRole("menuitemradio", { name: "System" }),
  ).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Escape");
  await expect(themeMenu).toBeHidden();
  await expect(theme).toBeFocused();

  await page.goto("/admin/taxonomy");
  await page.setViewportSize({ width: 320, height: 300 });
  const createTag = page.getByRole("button", {
    name: "Create tag",
    exact: true,
  });
  await createTag.press("Enter");
  const tagDialog = page.getByRole("dialog", { name: "Create tag" });
  await expect(tagDialog.getByLabel("Name")).toBeFocused();
  await tagDialog.getByLabel("Name").fill("Browser verification tag");
  await expect(tagDialog.getByLabel("Slug")).toHaveValue(
    "browser-verification-tag",
  );
  await expectNoPageOverflow(page);
  await screenshot(page, "tag-dialog-light-320");
  await page.keyboard.press("Escape");
  await expect(tagDialog).toBeHidden();
  await expect(createTag).toBeFocused();
  await createTag.press("Enter");
  await tagDialog.getByLabel("Name").fill("Browser verification tag");
  await tagDialog.getByRole("button", { name: "Create tag" }).click();
  await expect(tagDialog).toBeHidden();
  await expect(createTag).toBeFocused();
  const deleteTag = page.getByRole("button", {
    name: "Delete tag Browser verification tag",
  });
  await deleteTag.click();
  const deleteTagDialog = page.getByRole("dialog", { name: "Delete tag?" });
  await expect(deleteTagDialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(deleteTag).toBeFocused();
  await deleteTag.click();
  const deletion = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.startsWith("/api/admin/tags/") &&
      response.request().method() === "DELETE",
    { timeout: 25_000 },
  );
  await deleteTagDialog
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  expect((await deletion).ok()).toBe(true);
  await expect(deleteTag).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 760 });
  await page.goto("/admin/users");
  const addUser = page.getByRole("button", { name: "Add user" });
  await addUser.press("Enter");
  const createUser = page.getByRole("dialog", { name: "Create user" });
  await expect(createUser.getByLabel("Email")).toBeFocused();
  await screenshot(page, "create-user-mobile-390");
  await page.keyboard.press("Escape");
  await expect(createUser).toBeHidden();
  await expect(addUser).toBeFocused();

  await page.setViewportSize({ width: 1280, height: 800 });
  const origin = new URL(page.url()).origin;
  const fixtureTitle = "Szerkesztőségi ellenőrzés: árvíztűrő tükörfúrógép";
  const fixtureSlug = `dialog-design-fixture-${crypto.randomUUID()}-${"identifier".repeat(9)}`;

  const content = await page.request.post("/api/pages", {
    headers: { origin },
    data: {
      type: "PAGE",
      status: "DRAFT",
      slug: fixtureSlug,
      title: fixtureTitle,
      tagIds: [],
    },
  });
  expect(content.status()).toBe(201);
  const record = ContentRecordSchema.parse(await content.json());

  try {
    await page.goto(`/admin/pages/${record.id}`);
    const revisionsLink = page.getByRole("link", { name: "Working revisions" });
    await expect(revisionsLink).toBeVisible({ timeout: 25_000 });
    await revisionsLink.click();
    await expect(page.getByText("No saved revisions yet.")).toBeVisible();
    await selectTheme(page, "Light");
    await page.setViewportSize({ width: 1280, height: 900 });
    await screenshot(page, "revisions-empty-light-1280");
    const workingTitle = page.getByRole("textbox", { name: "Working title" });
    await expect(workingTitle).toHaveValue(fixtureTitle);
    await workingTitle.fill(`${fixtureTitle} - Working copy`);
    await page.getByRole("button", { name: "Save working revision" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Working revision saved." }),
    ).toBeVisible();

    for (const mode of ["Light", "Dark"] as const) {
      await selectTheme(page, mode);

      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoPageOverflow(page);
      }

      await page.setViewportSize({
        width: mode === "Light" ? 1440 : 390,
        height: 900,
      });
      await screenshot(page, `revisions-${mode.toLowerCase()}`);
    }

    await page.setViewportSize({ width: 320, height: 740 });
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    await expectNoPageOverflow(page);
    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );
    await selectTheme(page, "Light");
    await page.setViewportSize({ width: 320, height: 360 });
    await page.goto("/admin/pages");
    const search = page.getByRole("searchbox", { name: "Search" });
    await search.fill(fixtureSlug);
    await search.press("Enter");
    const table = page.getByRole("table", { name: "Pages" });
    await expect(
      table.getByRole("link", { name: fixtureTitle, exact: true }),
    ).toBeVisible();
    expect(
      await table.evaluate(
        (element) => element.scrollWidth - element.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await expectNoPageOverflow(page);
    await page
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption("PUBLISHED");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(table.getByText("No items found.")).toBeVisible();
    await page
      .getByRole("combobox", { name: "Status", exact: true })
      .selectOption("DRAFT");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(
      table.getByRole("link", { name: fixtureTitle, exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    const topbar = page.locator(".admin-topbar");
    await expect(topbar).toHaveAttribute("data-scrolled", "false");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(topbar).toHaveAttribute("data-scrolled", "true");
    await screenshot(page, "pages-scrolled-light-320");
    await page.setViewportSize({ width: 1280, height: 800 });
    const deleteAction = page.getByRole("button", {
      name: `Delete ${fixtureTitle}`,
    });
    await deleteAction.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Delete item?" });
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    await expect(cancel).toBeFocused();
    await expect(page.locator("html")).toHaveCSS("overflow-y", "hidden");
    await page.keyboard.press("Tab");
    await expect(
      dialog.getByRole("button", { name: "Delete", exact: true }),
    ).toBeFocused();
    await screenshot(page, "confirmation-1280");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(deleteAction).toBeFocused();
  } finally {
    const cleanup = await page.request.delete(`/api/pages/${record.id}`, {
      headers: { origin },
    });
    expect(cleanup.ok()).toBe(true);
  }
});
