import { expect, test } from "@playwright/test";

const tabs = ["General", "Publishing", "Authentication"];
const viewports = [320, 390, 768, 1024, 1440, 1920];

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
            page.getByRole("button", { name: "Save changes" }),
          ).toBeVisible();
          expect(
            await page.locator("#site-time-zone-options option").count(),
          ).toBeGreaterThan(1);

          if (width >= 1440) {
            const layout = page.locator(".admin-settings-general-layout");

            const geometry = await layout.evaluate((element) => {
              const grid = getComputedStyle(element);
              const panels = Array.from(element.querySelectorAll("section"));
              const site = panels[0]?.getBoundingClientRect();
              const dateTime = panels[1]?.getBoundingClientRect();
              const appearance = panels[2]?.getBoundingClientRect();

              return {
                rowGap: Number.parseFloat(grid.rowGap),
                siteDateTimeGap: (dateTime?.top ?? 0) - (site?.bottom ?? 0),
                dateTimeAppearanceGap:
                  (appearance?.top ?? 0) - (dateTime?.bottom ?? 0),
                panelWidths: panels.map((panel) =>
                  Math.round(panel.getBoundingClientRect().width),
                ),
              };
            });

            expect(geometry.rowGap).toBeGreaterThanOrEqual(16);
            expect(geometry.siteDateTimeGap).toBeGreaterThanOrEqual(16);
            expect(geometry.dateTimeAppearanceGap).toBeGreaterThanOrEqual(16);
            expect(Math.min(...geometry.panelWidths)).toBeGreaterThan(1_000);
          }
        }

        if (label === "Authentication") {
          const provider = page.locator(".admin-provider").first();
          const summary = provider.locator("summary");
          await summary.focus();
          await page.keyboard.press("Enter");
          await expect(provider.locator("input[type=password]")).toBeVisible();
          await page.keyboard.press("Enter");
          await expect(provider.locator("input[type=password]")).toBeHidden();
        }

        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);

        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: `.notes/admin-redesign/screenshots-post-ds-01j/${theme}-${width}-${label}.png`,
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
          "#settings-general > fieldset > .admin-settings-general-layout > section > div > .admin-settings-field-grid > div",
        );

        const first = await fields.nth(0).boundingBox();

        const second = await fields.nth(1).boundingBox();
        expect(first).not.toBeNull();
        expect(second).not.toBeNull();
        expect(second?.x).toBeGreaterThan(first?.x ?? 0);
      }
    }
  }

  await page.getByRole("button", { name: "Admin language: English" }).click();
  await page.getByRole("menuitemradio", { name: "Magyar" }).click();
  await page.getByRole("tablist").getByRole("tab").nth(0).click();
  await expect(
    page.getByRole("heading", { name: "Dátum és idő" }),
  ).toBeVisible();
  await expect(page.getByLabel("Webhely időzónája")).toBeVisible();
  await expect(page.getByLabel("Dátumformátum")).toBeVisible();
  await expect(page.getByLabel("Időformátum")).toBeVisible();
  await expect(page.getByText("Előnézet", { exact: false })).toBeVisible();

  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: theme, exact: true }).click();

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 900 });

      for (let index = 0; index < tabs.length; index += 1) {
        const tab = page.getByRole("tablist").getByRole("tab").nth(index);
        await tab.click();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(page.getByRole("tabpanel")).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);

        if (width === 1440) {
          await page.screenshot({
            path: `.notes/admin-redesign/screenshots-post-ds-01j/Hungarian-${theme}-${index}.png`,
            fullPage: index === 0,
          });
        }
      }
    }
  }

  await page.getByRole("button", { name: "Admin nyelve: Magyar" }).click();
  await page.getByRole("menuitemradio", { name: "English" }).click();

  await page.setViewportSize({ width: 390, height: 740 });
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
    path: ".notes/admin-redesign/screenshots-post-ds-01j/long-label-200-percent.png",
    fullPage: true,
  });
  await authenticationTab.press("Home");
  await expect(tablist.getByRole("tab", { name: "General" })).toBeFocused();

  for (const label of ["Save changes"]) {
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
