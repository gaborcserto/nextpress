import { expect, test, type Locator } from "@playwright/test";

async function readToolbar(toolbar: Locator) {
  return toolbar.evaluate((form) => {
    const search = form.querySelector(".admin-toolbar-search");
    const sort = form.querySelector(".admin-content-sort");
    const controls = Array.from(
      form.querySelectorAll("select, .admin-content-sort button"),
    );
    const [sortField, direction] = Array.from(
      sort?.querySelectorAll("select, button") ?? [],
    );
    const bounds = form.getBoundingClientRect();
    const searchBounds = search?.getBoundingClientRect();
    const visibleControls = controls
      .map((control) => control.getBoundingClientRect())
      .filter((control) => control.width > 0);
    const padding = getComputedStyle(form);

    return {
      overflow: form.scrollWidth - form.clientWidth,
      searchFillsRow:
        Math.abs(
          (searchBounds?.width ?? 0) -
            (form.clientWidth -
              parseFloat(padding.paddingLeft) -
              parseFloat(padding.paddingRight)),
        ) <= 1,
      controlsFit: visibleControls.every(
        (control) =>
          control.left >= bounds.left && control.right <= bounds.right,
      ),
      searchVisible:
        (searchBounds?.width ?? 0) > 0 &&
        (searchBounds?.left ?? 0) >= bounds.left &&
        (searchBounds?.right ?? 0) <= bounds.right,
      searchAboveControls: visibleControls.every(
        (control) => control.top >= (searchBounds?.bottom ?? 0),
      ),
      secondaryRows: new Set(
        visibleControls.map((control) => Math.round(control.top)),
      ).size,
      sortGrouped: Boolean(
        sortField &&
        direction &&
        Math.abs(
          sortField.getBoundingClientRect().top -
            direction.getBoundingClientRect().top,
        ) <= 1,
      ),
      sortIsCompact:
        (sortField?.getBoundingClientRect().width ?? 0) < form.clientWidth / 3,
      internalBorder: sort ? getComputedStyle(sort).borderBottomWidth : null,
      hasToolbarSeparator: parseFloat(padding.borderBottomWidth) > 0,
    };
  });
}

test("Posts and Pages share one compact toolbar at tablet widths", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  const signIn = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:49201" },
    data: {
      email: "admin@example.invalid",
      password: "Disposable browser passphrase 2026",
    },
  });
  expect(signIn.status()).toBe(200);

  for (const heading of ["Posts", "Pages"]) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/admin/${heading.toLowerCase()}`);
    const toolbar = page.locator(".admin-adaptive-list .admin-list-toolbar");
    const table = page.getByRole("table", { name: heading });
    const sort = toolbar.getByRole("combobox", { name: "Sort by" });
    const direction = toolbar.getByRole("button", {
      name: "Change sort direction",
    });
    await expect(table).toBeVisible();
    await expect(sort).toBeVisible();

    for (const width of [768, 820, 1024, 1440, 390]) {
      await page.setViewportSize({ width, height: 1024 });
      const layout = await readToolbar(toolbar);
      expect(layout.overflow, `${heading} at ${width}px`).toBeLessThanOrEqual(
        1,
      );
      expect(layout.controlsFit).toBe(true);
      expect(layout.searchVisible).toBe(true);
      expect(layout.hasToolbarSeparator).toBe(true);

      if (width === 768 || width === 820) {
        expect(layout).toMatchObject({
          searchFillsRow: true,
          searchAboveControls: true,
          secondaryRows: 1,
          sortGrouped: true,
          sortIsCompact: true,
          internalBorder: "0px",
        });
        await expect(
          table.getByRole("columnheader", { name: "Created" }),
        ).toHaveCount(0);
      }

      if (width === 390) {
        expect(layout.searchFillsRow).toBe(true);
        expect(layout.sortGrouped).toBe(true);
        await expect(
          table.getByRole("columnheader", { name: "Actions" }),
        ).toHaveCount(0);
      }

      if (width === 1440) {
        await expect(sort).toBeHidden();
        await expect(
          table.getByRole("columnheader", { name: "Created" }),
        ).toBeVisible();
      }

      const collapse = page.getByRole("button", {
        name: "Collapse sidebar",
        exact: true,
      });

      if (await collapse.isVisible()) {
        await collapse.press("Enter");
        const expand = page.getByRole("button", { name: "Expand sidebar" });
        await expect(expand).toBeVisible();
        const collapsed = await readToolbar(toolbar);
        expect(collapsed.overflow).toBeLessThanOrEqual(1);
        expect(collapsed.controlsFit).toBe(true);
        expect(collapsed.searchVisible).toBe(true);
        await expand.press("Enter");
        await expect(collapse).toBeVisible();
      }
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await toolbar.screenshot({
      path: `.notes/admin-redesign/layout-02-7/${heading.toLowerCase()}-768-en.png`,
    });
    await sort.press("Tab");
    await expect(direction).toBeFocused();

    await page.getByRole("button", { name: "Admin language: English" }).click();
    await page.getByRole("menuitemradio", { name: "Magyar" }).click();
    const localizedSort = toolbar.getByRole("combobox", { name: "Rendezés" });
    await localizedSort.selectOption("author");
    await expect(page).toHaveURL(/[?&]sort=author(?:&|$)/);
    await expect(
      page.locator('.admin-adaptive-list [aria-busy="true"]'),
    ).toHaveCount(0);
    await expect(localizedSort.locator("option:checked")).toHaveText("Szerző");
    expect(await readToolbar(toolbar)).toMatchObject({
      controlsFit: true,
      searchFillsRow: true,
      secondaryRows: 1,
      sortGrouped: true,
    });
    await toolbar.screenshot({
      path: `.notes/admin-redesign/layout-02-7/${heading.toLowerCase()}-768-hu.png`,
    });

    await page.getByRole("button", { name: "Admin nyelve: Magyar" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
  }
});

async function expectTaxonomySearch(search: Locator, desktopWidth?: number) {
  const geometry = await search.evaluate((input) => {
    const toolbar = input.closest("form");
    const icon = toolbar?.querySelector(".admin-search-submit");

    if (!toolbar || !icon) {
      throw new Error("Expected a toolbar with an embedded search button");
    }

    const bounds = input.getBoundingClientRect();
    const form = toolbar.getBoundingClientRect();
    const button = icon.getBoundingClientRect();
    const styles = getComputedStyle(toolbar);

    return {
      width: bounds.width,
      leftGap: Math.abs(
        bounds.left - form.left - parseFloat(styles.paddingLeft),
      ),
      rightGap: Math.abs(
        form.right - bounds.right - parseFloat(styles.paddingRight),
      ),
      iconOnRight:
        button.left > bounds.left + bounds.width / 2 &&
        button.right <= bounds.right,
      centerOffset: Math.abs(
        (bounds.top + bounds.bottom - button.top - button.bottom) / 2,
      ),
      overflow: toolbar.scrollWidth - toolbar.clientWidth,
    };
  });

  expect(geometry.leftGap).toBeLessThanOrEqual(1);

  if (desktopWidth === undefined) {
    expect(geometry.rightGap).toBeLessThanOrEqual(1);
  } else {
    expect(geometry.width).toBeCloseTo(desktopWidth, 0);
    expect(geometry.rightGap).toBeGreaterThan(1);
  }

  expect(geometry.iconOnRight).toBe(true);
  expect(geometry.centerOffset).toBeLessThanOrEqual(1);
  expect(geometry.overflow).toBeLessThanOrEqual(1);
}

test("Taxonomy search follows the listing width in both tabs", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const signIn = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:49201" },
    data: {
      email: "admin@example.invalid",
      password: "Disposable browser passphrase 2026",
    },
  });
  expect(signIn.status()).toBe(200);

  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.goto("/admin/posts");
  const desktopSearch = page.getByRole("searchbox", { name: "Search" });
  await expect(desktopSearch).toBeVisible();
  const desktopWidth = await desktopSearch.evaluate(
    (search) => search.getBoundingClientRect().width,
  );

  await page.goto("/admin/taxonomy");
  const tabs = page.getByRole("navigation", { name: "Taxonomy sections" });

  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: theme, exact: true }).click();

    for (const tab of ["Tags", "Categories"]) {
      await tabs.getByRole("link", { name: tab, exact: true }).click();
      await expect(page.getByRole("table", { name: tab })).toBeVisible();
      const search = page.getByRole("searchbox", { name: "Search" });
      const submit = page.getByRole("button", { name: "Submit search" });

      for (const width of [390, 768, 1280, 1440]) {
        await page.setViewportSize({ width, height: 1024 });
        await expectTaxonomySearch(
          search,
          width === 1440 ? desktopWidth : undefined,
        );

        if (width === 1280) {
          const collapse = page.getByRole("button", {
            name: "Collapse sidebar",
            exact: true,
          });
          await collapse.press("Enter");
          const expand = page.getByRole("button", { name: "Expand sidebar" });
          await expect(expand).toBeVisible();
          await expectTaxonomySearch(search, desktopWidth);
          await expand.press("Enter");
          await expect(collapse).toBeVisible();
          await expectTaxonomySearch(search);
        }
      }

      await search.fill("taxonomy-width-check");

      if (tab === "Tags") {
        await search.press("Enter");
      } else {
        await submit.click();
      }

      await expect(page).toHaveURL(/[?&]q=taxonomy-width-check(?:&|$)/);
      await expect(page.getByRole("table", { name: tab })).toBeVisible();
      await search.fill("");
      await submit.click();
      await expect(page).not.toHaveURL(/[?&]q=/);
    }
  }
});
