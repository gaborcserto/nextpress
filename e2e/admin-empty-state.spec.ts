import { expect, test, type Locator } from "@playwright/test";

async function inspectEmptyState(heading: Locator) {
  return heading.evaluate((title) => {
    const state = title.closest('[role="status"]');
    const icon = state?.querySelector("svg");
    const description = state?.querySelector("p");

    if (!state || !icon || !description) {
      throw new Error("Expected the complete empty state");
    }

    const box = state.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    const style = getComputedStyle(state);
    const titleStyle = getComputedStyle(title);
    const descriptionStyle = getComputedStyle(description);
    const row = title.closest("tr");

    return {
      surface: {
        background: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        radius: style.borderTopLeftRadius,
      },
      rowBackground: row ? getComputedStyle(row).backgroundColor : null,
      appearance: {
        gap: style.rowGap,
        padding: style.padding,
        headingWeight: titleStyle.fontWeight,
        headingSize: titleStyle.fontSize,
        headingLineHeight: titleStyle.lineHeight,
        descriptionSize: descriptionStyle.fontSize,
        descriptionColor: descriptionStyle.color,
        iconColor: getComputedStyle(icon).color,
        iconSize: iconBox.width,
      },
      centered:
        Math.abs(box.left + box.right - iconBox.left - iconBox.right) <= 2,
      overflow: state.scrollWidth - state.clientWidth,
    };
  });
}

test("Taxonomy empty states share Menus typography without a nested panel", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const auth = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:49201" },
    data: {
      email: "admin@example.invalid",
      password: "Disposable browser passphrase 2026",
    },
  });
  expect(auth.status()).toBe(200);

  await page.route("**/api/admin/navigation", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(/\/api\/admin\/tags\?/, (route) =>
    route.fulfill({
      json: { items: [], page: 1, limit: 50, total: 0, pages: 0 },
    }),
  );

  for (const theme of ["Light", "Dark"]) {
    await page.goto("/admin/settings/menus");
    const menu = page.getByRole("heading", { name: "No menu items yet" });
    await expect(menu).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
    const reference = await inspectEmptyState(menu);
    expect(reference.surface.borderStyle).toBe("dashed");
    expect(reference.surface.background).not.toBe("rgba(0, 0, 0, 0)");
    expect(parseFloat(reference.surface.radius)).toBeGreaterThan(0);
    expect(reference.appearance.iconSize).toBe(40);
    expect(reference.centered).toBe(true);

    await page.goto("/admin/taxonomy");
    const tabs = page.getByRole("navigation", { name: "Taxonomy sections" });

    for (const tab of ["Tags", "Categories"]) {
      await tabs.getByRole("link", { name: tab, exact: true }).click();
      const table = page.getByRole("table", { name: tab });
      const empty = table.getByRole("heading", {
        name: `No ${tab.toLowerCase()} yet`,
      });
      await expect(empty).toBeVisible();

      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 1024 });
        const state = await inspectEmptyState(empty);
        expect(state.appearance).toEqual(reference.appearance);
        expect(state.surface).toMatchObject({
          background: "rgba(0, 0, 0, 0)",
          borderWidth: "0px",
          radius: "0px",
        });
        expect(state.rowBackground).toBe("rgba(0, 0, 0, 0)");
        expect(state.centered).toBe(true);
        expect(state.overflow).toBeLessThanOrEqual(1);
        const results = await table.evaluate((element) => {
          const wrapper = element.parentElement;
          const panel = element.closest(".admin-list-surface");

          if (!wrapper || !panel) {
            throw new Error("Expected the existing listing surface");
          }

          const style = getComputedStyle(panel);

          return {
            overflow: wrapper.scrollWidth - wrapper.clientWidth,
            background: style.backgroundColor,
            border: style.borderTopWidth,
            radius: style.borderTopLeftRadius,
          };
        });
        expect(results.overflow).toBeLessThanOrEqual(1);
        expect(results.background).toBe(
          theme === "Light" ? "oklch(1 0 0)" : "oklch(0.2533 0.016 252.42)",
        );
        expect(parseFloat(results.border)).toBeGreaterThan(0);
        expect(parseFloat(results.radius)).toBeGreaterThan(0);
        await expect(
          page.getByRole("searchbox", { name: "Search" }),
        ).toBeVisible();
      }

      await empty.hover();
      expect((await inspectEmptyState(empty)).rowBackground).toBe(
        "rgba(0, 0, 0, 0)",
      );
      const search = page.getByRole("searchbox", { name: "Search" });
      await search.fill("missing");
      await search.press("Enter");
      const noMatches = table.getByRole("heading", {
        name: `No matching ${tab.toLowerCase()}`,
      });
      await expect(noMatches).toBeVisible();
      expect((await inspectEmptyState(noMatches)).surface.background).toBe(
        "rgba(0, 0, 0, 0)",
      );
      expect((await inspectEmptyState(noMatches)).surface.borderWidth).toBe(
        "0px",
      );
      await search.fill("");
      await search.press("Enter");
      await expect(empty).toBeVisible();
    }
  }
});
