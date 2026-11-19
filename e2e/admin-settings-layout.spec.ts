import { expect, test } from "@playwright/test";

const tabs = ["General", "Publishing", "Authentication"];
const viewports = [320, 375, 768, 1024, 1440, 1920];

test("Settings layout adapts across themes and viewport widths", async ({
  page,
}) => {
  test.setTimeout(120_000);

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/admin/settings");

  const tablist = page.getByRole("tablist", { name: "Settings sections" });
  const workspace = page.locator(".admin-settings-workspace");

  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: theme, exact: true }).click();

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });

      for (const label of tabs) {
        const tab = tablist.getByRole("tab", { name: label, exact: true });
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(page.getByRole("tabpanel")).toBeVisible();

        if (label === "General") {
          await expect(
            page.getByRole("heading", { name: "Site information" }),
          ).toBeVisible();
          await expect(
            page.getByRole("heading", { name: "Website appearance" }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", { name: "Save site settings" }),
          ).toBeVisible();
        }

        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);

        if (width === 320 || width === 1440) {
          await page.screenshot({
            path: `.notes/admin-redesign/screenshots-admin0341/${theme}-${width}-${label}.png`,
            style: "nextjs-portal { display: none; }",
            fullPage: label === "General",
          });
        }
      }

      if (width >= 1440) {
        expect((await workspace.boundingBox())?.width ?? 0).toBeGreaterThan(
          1_000,
        );
      }

      if (width >= 1440) {
        await tablist.getByRole("tab", { name: "General" }).click();
        const fields = page.locator(
          "#settings-general .admin-settings-field-grid > div",
        );

        const first = await fields.nth(0).boundingBox();

        const second = await fields.nth(1).boundingBox();
        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(second?.x).toBeGreaterThan(first?.x ?? 0);
      }
    }
  }

  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    const authenticationTab = document.getElementById(
      "settings-authentication-tab",
    );

    if (authenticationTab) {
      authenticationTab.textContent =
        "Hitelesítési és bejelentkezési beállítások";
    }
  });

  const authenticationTab = page.locator("#settings-authentication-tab");
  await page.screenshot({
    path: ".notes/admin-redesign/screenshots-admin0341/long-label-200-percent.png",
    fullPage: true,
  });
  await authenticationTab.press("Home");
  await expect(tablist.getByRole("tab", { name: "General" })).toBeFocused();

  for (const label of ["Save appearance", "Save site settings"]) {
    const button = page.getByRole("button", { name: label });
    expect(
      await button.evaluate((element) => {
        const text = element.querySelector("span > span");

        return (
          !!text &&
          text.getBoundingClientRect().right <=
            element.getBoundingClientRect().right + 1
        );
      }),
    ).toBe(true);
  }

  const overflow = await page.evaluate(() =>
    Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();

        return {
          tag: element.tagName,
          className:
            typeof element.className === "string" ? element.className : "",
          text: element.textContent?.trim().slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      })
      .filter(({ right }) => right > window.innerWidth + 1)
      .slice(0, 12),
  );
  expect(overflow, JSON.stringify(overflow)).toEqual([]);
  expect(
    await authenticationTab.evaluate(
      (element) => getComputedStyle(element).transitionProperty,
    ),
  ).toBe("none");
});
