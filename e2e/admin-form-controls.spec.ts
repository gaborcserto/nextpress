import { expect, test, type Page } from "@playwright/test";

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: `.notes/admin-redesign/screenshots-admin0344-run-20261118/${name}.png`,
    style: "nextjs-portal { display: none; }",
    animations: "disabled",
  });
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );

  expect(overflow).toBeLessThanOrEqual(1);
}

test("Admin form controls use the browser picker and reflow at large text sizes", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({
    colorScheme: "light",
    reducedMotion: "no-preference",
  });
  await page.goto("/auth/sign-in");
  const email = page.getByLabel("Email", { exact: true });
  const password = page.getByLabel("Password", { exact: true });
  await email.focus();
  await expect(email).toHaveCSS("outline-style", "solid");
  await capture(page, "sign-in-light");
  await email.fill("admin@example.invalid");
  await password.fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 45_000 });

  await page.goto("/admin/settings#settings-publishing");
  const listing = page.getByRole("combobox", { name: "Listing mode" });
  await expect(listing).toBeVisible({ timeout: 25_000 });
  await expect(listing).toHaveCSS("appearance", "base-select");
  const batch = page.getByRole("spinbutton", {
    name: "Posts per page / batch",
  });
  await expect(listing).toHaveCSS(
    "height",
    await batch.evaluate((field) => getComputedStyle(field).height),
  );
  const chevron = page.locator(
    ".admin-select-trigger:has(#post-listing-mode) svg",
  );
  await listing.press("Space");
  await expect(page.locator("#post-listing-mode:open")).toHaveCount(1);
  await expect(chevron).toHaveCSS("rotate", "180deg");
  await expect(page.locator("#post-listing-mode option:checked")).toHaveText(
    "Pagination",
  );
  await capture(page, "publishing-picker-light");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(listing).toHaveValue("LOAD_MORE");
  await expect(listing).toBeFocused();

  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await listing.selectOption("PAGINATION");
  const longOption = page.locator(
    '#post-listing-mode option[value="LOAD_MORE"]',
  );
  await longOption.evaluate((option) => {
    option.textContent = "További bejegyzések betöltése a nyilvános oldalon";
  });
  await listing.evaluate((field) => {
    const position = field.getBoundingClientRect();
    window.scrollBy(0, position.bottom - window.innerHeight + 16);
  });
  const triggerBottom = await listing.evaluate(
    (field) => field.getBoundingClientRect().bottom,
  );

  const edgeHeight = Math.min(740, Math.ceil(triggerBottom) + 16);
  await page.setViewportSize({ width: 320, height: edgeHeight });
  await listing.press("Space");
  await expect(page.locator("#post-listing-mode:open")).toHaveCount(1);
  const duration = await chevron.evaluate((icon) =>
    Number.parseFloat(getComputedStyle(icon).transitionDuration),
  );
  expect(duration).toBeLessThan(0.001);
  const bounds = await longOption.boundingBox();

  if (!bounds) {
    throw new Error("The long option is outside the open picker");
  }

  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(edgeHeight);
  expect(bounds.y).toBeLessThan((await listing.boundingBox())?.y ?? 0);
  await capture(page, "publishing-picker-dark-320-large-text");
  await page.keyboard.press("Escape");
  await expect(page.locator("#post-listing-mode:open")).toHaveCount(0);
  await expect(listing).toBeFocused();
  await expect(listing).toHaveValue("PAGINATION");

  const compactHeight = await listing.evaluate((field) => field.clientHeight);
  await listing.selectOption("LOAD_MORE");
  expect(await listing.evaluate((field) => field.clientHeight)).toBe(
    compactHeight,
  );
  await listing.scrollIntoViewIfNeeded();
  await capture(page, "publishing-selected-dark-320-large-text");

  await page.evaluate(() => {
    document.documentElement.style.removeProperty("font-size");
  });
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole("tab", { name: "Authentication" }).click();
  await page
    .locator("summary")
    .filter({ hasText: /github/i })
    .click();
  const secret = page.getByLabel("github new secret");
  await expect(secret).toHaveValue("");
  await expect(secret).toHaveAttribute("autocomplete", "new-password");
  await secret.focus();
  await capture(page, "oauth-dark-320");

  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add user" }).click();
  const dialog = page.getByRole("dialog", { name: "Create user" });
  const role = dialog.getByRole("combobox", { name: "Role" });
  await role.press("Space");
  await expect(dialog.locator("select:open")).toHaveCount(1);
  await capture(page, "user-role-picker-dark-320");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(role).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.setViewportSize({ width: 1440, height: 900 });

  for (const route of ["posts", "pages"]) {
    await page.goto(`/admin/${route}/new`);
    const status = page.getByRole("combobox", { name: "Status", exact: true });
    await expect(
      page.getByRole("textbox", { name: "Title", exact: true }),
    ).toBeVisible();
    await status.click();
    await expect(page.locator("select:open")).toHaveCount(1);
    await capture(page, `${route}-metadata-picker-dark`);
    await page.keyboard.press("Escape");
  }

  for (const route of ["posts", "pages"]) {
    await page.goto(`/admin/${route}`);
    const search = page.getByRole("searchbox", {
      name: "Search this page",
    });
    const status = page.getByRole("combobox", {
      name: "Status",
      exact: true,
    });

    await expect(search).toBeVisible();
    await expect(status).toHaveCSS("appearance", "base-select");
    await expect(status).toHaveCSS(
      "height",
      await search.evaluate((field) => getComputedStyle(field).height),
    );
    await status.press("Space");
    await expect(page.locator(".admin-list-toolbar select:open")).toHaveCount(
      1,
    );
    await expect(
      page.locator(".admin-list-toolbar .admin-select-chevron"),
    ).toHaveCSS("rotate", "180deg");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(status).toHaveValue("DRAFT");
    await expect(status).toBeFocused();
    await status.selectOption("PUBLISHED");
    await expect(status).toHaveValue("PUBLISHED");
    await capture(page, `${route}-status-dark-desktop`);
  }

  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: "Light" }).click();
  await page.setViewportSize({ width: 320, height: 740 });

  for (const route of ["posts", "pages"]) {
    await page.goto(`/admin/${route}`);
    await expect(
      page.getByRole("combobox", { name: "Status", exact: true }),
    ).toBeVisible();
    await expectNoOverflow(page);
    await capture(page, `${route}-status-light-mobile`);
  }
});
