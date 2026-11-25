import { expect, test } from "@playwright/test";

const screens = [
  { name: "Menus", path: "/admin/settings/menus", tabs: '[role="tablist"]' },
  {
    name: "Taxonomy",
    path: "/admin/taxonomy",
    tabs: 'nav[aria-label="Taxonomy sections"]',
  },
  { name: "Media Library", path: "/admin/media", tabs: '[role="tablist"]' },
  { name: "Settings", path: "/admin/settings", tabs: '[role="tablist"]' },
];

test("keeps Admin tab-to-panel spacing consistent", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const screen of screens) {
    await page.goto(screen.path);
    const tabs = page.locator(screen.tabs);
    await expect(tabs).toBeVisible();

    if (screen.name === "Taxonomy") {
      await expect(
        page.getByRole("searchbox", { name: "Search" }),
      ).toBeVisible();
    }

    if (screen.name === "Settings") {
      await expect(
        page.getByRole("heading", { name: "Site information" }),
      ).toBeVisible();
    }

    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });

      const geometry = await tabs.evaluate((nav) => {
        const following = nav.nextElementSibling;
        const parent = nav.parentElement;
        const panel =
          following?.querySelector('[role="tabpanel"]:not([hidden])') ??
          following;

        if (!panel || !parent) {
          throw new Error(
            "Expected tab navigation with a following content panel",
          );
        }

        return {
          distance:
            panel.getBoundingClientRect().top -
            nav.getBoundingClientRect().bottom,
          gap: getComputedStyle(parent).rowGap,
          tabsMargin: getComputedStyle(nav).marginBlockEnd,
          panelMargin: getComputedStyle(panel).marginBlockStart,
        };
      });

      expect(geometry, screen.name + " at " + width + "px").toEqual({
        distance: 24,
        gap: "24px",
        tabsMargin: "0px",
        panelMargin: "0px",
      });
    }
  }
});
