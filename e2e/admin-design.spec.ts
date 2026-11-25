import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const screenshotDirectory = ".notes/admin-redesign/screenshots-post-ds-01j1";
const widths = [320, 390, 768, 1023, 1024, 1280, 1440, 1920];
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
  const themeTrigger = page.getByRole("button", { name: /^Theme:/ });
  let readinessAttempts = 0;

  await expect
    .poll(async () => {
      readinessAttempts += 1;

      if ((await themeTrigger.getAttribute("aria-expanded")) === "true") {
        return true;
      }

      await themeTrigger.press("ArrowDown");

      return (await themeTrigger.getAttribute("aria-expanded")) === "true";
    })
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(themeTrigger).toHaveAttribute("aria-expanded", "false");

  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await expect(
    page.getByRole("status").filter({ hasText: /Welcome,/ }),
  ).toBeVisible();

  return readinessAttempts;
}

test("@cross-browser sign-in keeps credentials out of navigation URLs", async ({
  page,
}, testInfo: TestInfo) => {
  const diagnostics: Array<Record<string, string | string[]>> = [];

  page.on("framenavigated", (frame) => {
    const url = new URL(frame.url());

    diagnostics.push({
      event: "navigation",
      pathname: url.pathname,
      queryKeys: [...url.searchParams.keys()],
    });
  });
  page.on("pageerror", (error) => {
    diagnostics.push({ event: "pageerror", message: error.message });
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      diagnostics.push({ event: "console-error", message: message.text() });
    }
  });
  page.on("requestfailed", (request) => {
    diagnostics.push({
      event: "request-failed",
      pathname: new URL(request.url()).pathname,
      failure: request.failure()?.errorText ?? "unknown",
    });
  });

  await page.goto("/auth/sign-in");
  const readinessAttempts = await signIn(page);
  await expect(page).toHaveURL(/\/admin$/);
  console.log(
    "Cross-browser sign-in diagnostics",
    JSON.stringify({ readinessAttempts, navigation: diagnostics }),
  );
  await testInfo.attach("cross-browser-sign-in-diagnostics", {
    body: JSON.stringify(
      { readinessAttempts, navigation: diagnostics },
      null,
      2,
    ),
    contentType: "application/json",
  });
  expect(
    diagnostics
      .filter((event) => event.event === "navigation")
      .every((event) => event.queryKeys?.length === 0),
  ).toBe(true);
});

async function selectTheme(page: Page, mode: "Light" | "Dark" | "System") {
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${screenshotDirectory}/${name}.png`,
    animations: "disabled",
    style: "nextjs-portal { display: none; }",
  });
}

async function expectNoPageOverflow(page: Page) {
  const { overflow, elements } = await page.evaluate(() => {
    const overflow = document.documentElement.scrollWidth - window.innerWidth;
    const elements =
      overflow > 1
        ? Array.from(document.querySelectorAll(".admin-workspace *"))
            .filter(
              (element) =>
                element.getBoundingClientRect().right > window.innerWidth + 1,
            )
            .slice(0, 8)
            .map((element) => element.id || element.tagName)
        : [];

    return { overflow, elements };
  });
  expect(
    overflow,
    `Unexpected page overflow at ${page.url()} with width ${page.viewportSize()?.width}. Outside viewport: ${elements.join(", ")}`,
  ).toBeLessThanOrEqual(1);
}

async function expectHeaderAligned(page: Page) {
  const alignment = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(".admin-topbar");
    const content = document.querySelector<HTMLElement>(".admin-content");

    if (!header || !content) {
      throw new Error("Expected the Admin header and content workspace");
    }

    const headerBounds = header.getBoundingClientRect();
    const contentBounds = content.getBoundingClientRect();
    const styles = getComputedStyle(content);

    return {
      headerLeft: headerBounds.left,
      headerRight: headerBounds.right,
      contentLeft: contentBounds.left + Number.parseFloat(styles.paddingLeft),
      contentRight:
        contentBounds.right - Number.parseFloat(styles.paddingRight),
    };
  });

  expect(alignment.headerLeft).toBeCloseTo(alignment.contentLeft, 0);
  expect(alignment.headerRight).toBeCloseTo(alignment.contentRight, 0);
}

async function inspectSidebarDividers(page: Page) {
  const dividers = await page
    .locator(".admin-rail .admin-sidebar")
    .evaluate((sidebar) => {
      const heading = sidebar.querySelector<HTMLElement>(
        ".admin-sidebar-heading",
      );
      const sections = Array.from(
        sidebar.querySelectorAll<HTMLElement>(
          ".admin-sidebar-nav .admin-nav-section",
        ),
      );
      const footer = sidebar.querySelector<HTMLElement>(
        ".admin-sidebar-footer",
      );

      if (!heading || sections.length < 2 || !footer) {
        throw new Error("Expected the Admin sidebar divider structure");
      }

      const brand = heading.getBoundingClientRect();
      const brandSeparator = getComputedStyle(heading, "::after");
      const firstSection = getComputedStyle(sections[0], "::before");
      const administration = getComputedStyle(sections[1], "::before");
      const collapse = getComputedStyle(footer, "::before");
      const footerBounds = footer.getBoundingClientRect();
      const administrationBounds = sections[1].getBoundingClientRect();

      return {
        separatorCount:
          Number(brandSeparator.content !== "none") +
          Number(administration.content !== "none") +
          Number(collapse.content !== "none"),
        publishingSeparator: firstSection.content,
        widths: [
          Number.parseFloat(brandSeparator.width),
          Number.parseFloat(administration.width),
          Number.parseFloat(collapse.width),
        ],
        leftEdges: [
          brand.left + Number.parseFloat(brandSeparator.left),
          administrationBounds.left + Number.parseFloat(administration.left),
          footerBounds.left + Number.parseFloat(collapse.left),
        ],
        borderWidths: [
          brandSeparator.borderBottomWidth,
          administration.borderTopWidth,
          collapse.borderTopWidth,
        ],
      };
    });

  expect(dividers.separatorCount, JSON.stringify(dividers)).toBe(3);
  expect(dividers.publishingSeparator).toBe("none");
  expect(dividers.widths[1]).toBeCloseTo(dividers.widths[0], 0);
  expect(dividers.widths[2]).toBeCloseTo(dividers.widths[0], 0);
  expect(dividers.leftEdges[1]).toBeCloseTo(dividers.leftEdges[0], 0);
  expect(dividers.leftEdges[2]).toBeCloseTo(dividers.leftEdges[0], 0);
  expect(new Set(dividers.borderWidths)).toEqual(new Set(["1px"]));
}

async function expectCollapsedSidebarCentered(page: Page) {
  const positions = await page
    .locator(".admin-rail .admin-sidebar")
    .evaluate((sidebar) => {
      const bounds = sidebar.getBoundingClientRect();
      const center = bounds.left + bounds.width / 2;
      const icons = Array.from(
        sidebar.querySelectorAll<SVGElement>(".admin-nav-link svg"),
      ).map((icon) => {
        const rect = icon.getBoundingClientRect();

        return rect.left + rect.width / 2;
      });
      const active = sidebar.querySelector<HTMLElement>(
        '.admin-nav-link[aria-current="page"]',
      );
      const activeBounds = active?.getBoundingClientRect();
      const brand = sidebar
        .querySelector<HTMLElement>(".admin-wordmark")
        ?.getBoundingClientRect();

      return {
        center,
        icons,
        activeCenter: activeBounds
          ? activeBounds.left + activeBounds.width / 2
          : null,
        brandCenter: brand ? brand.left + brand.width / 2 : null,
      };
    });

  for (const icon of positions.icons) {
    expect(icon).toBeCloseTo(positions.center, 0);
  }

  expect(positions.activeCenter).toBeCloseTo(positions.center, 0);
  expect(positions.brandCenter).toBeCloseTo(positions.center, 0);
}

async function inspectHeaderUtilities(page: Page) {
  const controls = page.locator(
    ".admin-topbar-controls > .admin-dropdown > .btn",
  );
  await expect(controls).toHaveCount(3);

  const metrics = await controls.evaluateAll((buttons) =>
    buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      const style = getComputedStyle(button);

      return {
        width: bounds.width,
        height: bounds.height,
        radius: style.borderRadius,
        transition: style.transitionDuration,
      };
    }),
  );

  expect(new Set(metrics.map(({ width }) => width)).size).toBe(1);
  expect(new Set(metrics.map(({ height }) => height)).size).toBe(1);
  expect(new Set(metrics.map(({ radius }) => radius)).size).toBe(1);
  expect(new Set(metrics.map(({ transition }) => transition)).size).toBe(1);

  const hoverBackgrounds: string[] = [];

  for (const control of await controls.all()) {
    await control.hover();
    await page.waitForTimeout(180);
    hoverBackgrounds.push(
      await control.evaluate(
        (button) => getComputedStyle(button).backgroundColor,
      ),
    );
  }

  expect(new Set(hoverBackgrounds).size).toBe(1);
  expect(hoverBackgrounds[0]).not.toBe("rgba(0, 0, 0, 0)");
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
  await inspectHeaderUtilities(page);
  await inspectSidebarDividers(page);
  await expect(theme).toHaveAccessibleName("Theme: Light");
  await page.setViewportSize({ width: 1440, height: 900 });
  await selectTheme(page, "Dark");
  await inspectHeaderUtilities(page);
  await page.getByRole("button", { name: "Collapse" }).click();
  await expect(
    page.getByRole("button", { name: "Expand sidebar" }),
  ).toBeVisible();
  await inspectSidebarDividers(page);
  await expectCollapsedSidebarCentered(page);
  await expectNoPageOverflow(page);
  await screenshot(page, "sidebar-collapsed-dark-1440");
  const expandSidebar = page.getByRole("button", { name: "Expand sidebar" });
  await expandSidebar.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Collapse" })).toBeVisible();

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

    if (["/posts", "/pages"].includes(path)) {
      await expect(
        page.getByRole("columnheader", { name: "Author", exact: true }),
      ).toBeVisible();
      await expect(page.locator(".admin-content-author").first()).toBeVisible();
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
        await page.evaluate(
          () =>
            new Promise<void>((resolve) => {
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              );
            }),
        );
        await expectNoPageOverflow(page);
        await expectHeaderAligned(page);

        if (width === 390 && ["/posts", "/pages"].includes(path)) {
          const author = page.locator(".admin-content-author").first();
          await expect(author).toBeVisible();
          await expect(author.locator(".admin-cell-label")).toHaveText(
            "Author",
          );
        }

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
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      const stickyInset = await page
        .locator(".admin-topbar")
        .evaluate((header) => Number.parseFloat(getComputedStyle(header).top));
      await expect
        .poll(() =>
          page
            .locator(".admin-topbar")
            .evaluate((header) => header.getBoundingClientRect().top),
        )
        .toBeCloseTo(stickyInset, 0);
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

    if (path === "") {
      const topbar = page.getByRole("banner");
      const currentCrumb = topbar.getByText("Dashboard", { exact: true });

      const topbarPosition = await topbar.evaluate(
        (header) => getComputedStyle(header).position,
      );
      expect(["relative", "sticky"]).toContain(topbarPosition);

      if (topbarPosition === "relative") {
        await expect(topbar).toHaveAttribute("data-tall");
      }

      const visibleText = await currentCrumb.evaluate((crumb) => ({
        height: crumb.clientHeight,
        fullHeight: crumb.scrollHeight,
      }));
      expect(visibleText.height).toBe(visibleText.fullHeight);

      const quickActions = page
        .getByRole("main")
        .getByRole("group", { name: "Quick actions" });

      const overflowingActions = await quickActions
        .getByRole("link")
        .evaluateAll((links) =>
          links.flatMap((link) => {
            const labelRange = document.createRange();
            labelRange.selectNodeContents(link);

            const label = labelRange.getBoundingClientRect();
            const action = link.getBoundingClientRect();

            return label.top < action.top || label.bottom > action.bottom
              ? [link.textContent]
              : [];
          }),
        );
      expect(overflowingActions).toEqual([]);
      await screenshot(page, "dashboard-dark-320-text-200");
    }

    await page.evaluate(() =>
      document.documentElement.style.removeProperty("font-size"),
    );
  }

  await page.goto("/admin/posts");
  await page.getByRole("button", { name: "Admin language: English" }).click();
  await page.getByRole("menuitemradio", { name: "Magyar" }).click();
  await expect(
    page.getByRole("columnheader", { name: "Szerző", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".admin-content-author .admin-cell-label").first(),
  ).toHaveText("Szerző");
  await page.getByRole("button", { name: "Admin nyelve: Magyar" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

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

    const primaryBounds = await page
      .locator(".admin-writing-primary")
      .boundingBox();

    const sidebarBounds = await page
      .locator(".admin-writing-layout > aside")
      .boundingBox();
    expect(canvasBounds?.height).toBeGreaterThanOrEqual(240);
    expect(primaryBounds?.width).toBeGreaterThan(sidebarBounds?.width ?? 0);
    const controlStyles = await page.evaluate(() => {
      const status = document.querySelector<HTMLElement>(
        'select[id$="-status"]',
      );
      const date = document.querySelector<HTMLElement>('input[id$="-date"]');
      const time = document.querySelector<HTMLElement>('input[id$="-time"]');
      const tags = document.querySelector<HTMLElement>(
        ".admin-writing-layout aside .admin-multivalue-control",
      );

      if (!status || !date || !time || !tags) {
        throw new Error("Expected shared publication and tags controls");
      }

      return [status, date, time, tags].map((control) => ({
        height: control.getBoundingClientRect().height,
        border: getComputedStyle(control).borderTopColor,
      }));
    });
    expect(new Set(controlStyles.map(({ height }) => height)).size).toBe(1);
    expect(new Set(controlStyles.map(({ border }) => border)).size).toBe(1);
    await screenshot(page, `new-${segment}-light-1440`);
    const calendarTrigger = page.getByRole("button", {
      name: "Open calendar",
    });
    await calendarTrigger.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await screenshot(page, `publication-picker-${segment}-light-1440`);
    await page.keyboard.press("Escape");
    await expect(calendarTrigger).toBeFocused();
    await page.setViewportSize({ width: 390, height: 800 });
    await selectTheme(page, "Dark");
    await expectNoPageOverflow(page);
    await screenshot(page, `new-${segment}-dark-390`);
    await calendarTrigger.click();
    const mobilePicker = page.getByRole("dialog");
    await expect(mobilePicker).toBeVisible();
    const mobilePickerBounds = await mobilePicker.boundingBox();
    expect(mobilePickerBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
      (mobilePickerBounds?.x ?? 0) + (mobilePickerBounds?.width ?? 0),
    ).toBeLessThanOrEqual(390);
    await expectNoPageOverflow(page);
    await screenshot(page, `publication-picker-${segment}-dark-390`);
    await page.keyboard.press("Escape");
    await expect(calendarTrigger).toBeFocused();

    for (const mode of ["Light", "Dark"] as const) {
      await selectTheme(page, mode);

      for (const width of widths) {
        await page.setViewportSize({ width, height: 900 });
        await expectNoPageOverflow(page);

        if (width === 1440) {
          const topbar = page.getByRole("banner");
          await page.evaluate(() =>
            window.scrollTo({ top: 0, behavior: "instant" }),
          );
          await expect(topbar).toHaveAttribute("data-scrolled", "false");
          await expect(topbar).toHaveCSS("box-shadow", "none");
          await page.evaluate(() =>
            window.scrollTo({ top: 400, behavior: "instant" }),
          );
          await expect(topbar).toHaveAttribute("data-scrolled", "true");
          await expect
            .poll(() =>
              topbar.evaluate((element) => getComputedStyle(element).boxShadow),
            )
            .not.toBe("none");
          await page.evaluate(() =>
            window.scrollTo({ top: 0, behavior: "instant" }),
          );
        }
      }
    }

    await page.setViewportSize({ width: 1440, height: 800 });
    const topbar = page.getByRole("banner");
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(topbar).toHaveAttribute("data-scrolled", "false");
    await expect(topbar).toHaveCSS("box-shadow", "none");
    await expect(topbar).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.evaluate(() =>
      window.scrollTo({ top: 400, behavior: "instant" }),
    );
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await expect(topbar).toHaveCSS("position", "sticky");
    await expect
      .poll(() =>
        topbar.evaluate((element) => getComputedStyle(element).boxShadow),
      )
      .not.toBe("none");
    await expect
      .poll(() =>
        topbar.evaluate((element) => getComputedStyle(element).backdropFilter),
      )
      .toContain("blur");
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

  await screenshot(page, "navigation-mobile-390");
  await page.keyboard.press("Escape");
  await expect(navigation).toBeHidden();
  await expect(navigationTrigger).toBeFocused();

  await selectTheme(page, "Dark");
  await page.setViewportSize({ width: 320, height: 300 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await navigationTrigger.press("Enter");
  const menus = navigation.getByRole("link", { name: "Menus", exact: true });
  await menus.focus();
  await expect(menus).toBeInViewport();
  await expect(menus).toHaveCSS("outline-style", "solid");
  await expect(
    navigation.getByRole("button", { name: "Close navigation" }),
  ).toBeInViewport();
  await expectNoPageOverflow(page);
  await screenshot(page, "navigation-dark-short-320-text-200");
  await page.keyboard.press("Escape");
  await expect(navigationTrigger).toBeFocused();
  await page.evaluate(() =>
    document.documentElement.style.removeProperty("font-size"),
  );
  await page.setViewportSize({ width: 390, height: 760 });

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
  await account.press("Enter");
  await expect(menu.getByRole("menuitem", { name: "Profile" })).toBeFocused();
  await page.keyboard.press("Tab");
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
  await selectTheme(page, "Light");

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
    const hierarchySummary = page.getByText("Page hierarchy", {
      exact: true,
    });
    await screenshot(page, "page-hierarchy-collapsed-light-1280");
    await hierarchySummary.press("Enter");
    const hierarchyPanel = page.locator(".admin-hierarchy-panel");
    await expect(hierarchyPanel).toHaveAttribute("open", "");
    await expect(
      hierarchyPanel.getByRole("combobox", { name: "Parent Page" }),
    ).toBeVisible();
    const hierarchyOrder = hierarchyPanel.getByRole("spinbutton", {
      name: "Sibling order",
    });
    await hierarchyOrder.fill("17");
    const saveHierarchy = hierarchyPanel.getByRole("button", {
      name: "Save hierarchy",
    });
    await expect(saveHierarchy).toBeEnabled();
    await screenshot(page, "page-hierarchy-expanded-light-1280");
    await saveHierarchy.click();
    await expect(
      hierarchyPanel
        .getByRole("status")
        .filter({ hasText: "Page hierarchy saved." }),
    ).toBeVisible();
    await hierarchySummary.press("Enter");
    await expect(hierarchyPanel).not.toHaveAttribute("open", "");

    const revisionsLink = page.getByRole("link", { name: "Working revisions" });
    await expect(revisionsLink).toBeVisible({ timeout: 25_000 });
    await revisionsLink.click();
    await expect(page).toHaveURL(/\/revisions$/);
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
