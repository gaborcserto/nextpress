import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const adminOrigin = "http://localhost:49201";
const publicOrigin = "http://localhost:49200";
const headers = { origin: adminOrigin };
const screenshotDirectory = ".notes/ds-01f-accessibility";

declare global {
  interface Window {
    axe: {
      run: () => Promise<{
        violations: Array<{
          id: string;
          impact: string | null;
          help: string;
          nodes: Array<{ target: string[]; failureSummary?: string }>;
        }>;
      }>;
    };
  }
}

async function signIn(page: Page) {
  await page.goto(`${adminOrigin}/auth/sign-in`);

  const signInButton = page.getByRole("button", {
    name: "Sign in",
    exact: true,
  });
  await expect(signInButton).toBeVisible();
  await expect(signInButton).toBeEnabled();
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await signInButton.click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function capture(page: Page, name: string) {
  await mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(screenshotDirectory, `${name}.png`),
    animations: "disabled",
    style: "nextjs-portal { display: none; }",
  });
}

async function expectNoAxeViolations(page: Page, name: string) {
  await page.addScriptTag({
    path: path.resolve("node_modules/axe-core/axe.min.js"),
  });

  const violations = await page.evaluate(async () => {
    const results = await window.axe.run();

    return results.violations.map(({ id, impact, help, nodes }) => ({
      id,
      impact,
      help,
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    }));
  });

  expect(violations, `${name}: ${JSON.stringify(violations)}`).toEqual([]);
}

test("representative Admin dashboard and create-user dialog pass axe", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await expect(
    page.getByRole("heading", { name: "Recently updated content" }),
  ).toBeVisible();

  const theme = page.getByRole("button", { name: /^Theme:/ });
  await expect(theme).toBeVisible();
  await expect(theme).toHaveAttribute("aria-expanded", "false");
  await capture(page, "admin-dashboard-light-desktop");
  await expectNoAxeViolations(page, "Admin light dashboard");

  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "admin-dashboard-light-mobile");
  await theme.click();
  await expect(page.getByRole("menuitemradio", { name: "Dark" })).toBeVisible();
  await expectNoAxeViolations(page, "Admin theme menu");
  await capture(page, "admin-theme-menu-light-mobile");
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await capture(page, "admin-dashboard-dark-mobile");
  await expectNoAxeViolations(page, "Admin dark dashboard");
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "admin-dashboard-dark-desktop");

  await page.goto(`${adminOrigin}/admin/users`);
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await capture(page, "admin-users-dark-desktop");
  await page.getByRole("button", { name: "Add user" }).click();
  const dialog = page.getByRole("dialog", { name: "Create user" });
  await expect(dialog).toBeVisible();
  await capture(page, "admin-create-user-dialog-dark-desktop");
  await expectNoAxeViolations(page, "Admin create-user dialog");
  const email = dialog.getByRole("textbox", { name: "Email" });
  await email.fill("not-an-email");
  expect(
    await email.evaluate(
      (input: HTMLInputElement) => input.validity.typeMismatch,
    ),
  ).toBe(true);
  await expect(email).toBeFocused();
  await email.fill("admin@example.invalid");
  await dialog
    .getByRole("button", { name: "Create user", exact: true })
    .click();
  const errorAnnouncement = dialog.getByRole("alert");
  await expect(errorAnnouncement).toBeVisible();
  await expectNoAxeViolations(page, "Admin create-user error announcement");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Add user" })).toBeFocused();
});

test("Public preset home pages pass axe after hydration", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  for (const preset of ["classic", "modern", "minimal"] as const) {
    for (const colorMode of ["light", "dark"] as const) {
      const response = await page.request.put(
        `${adminOrigin}/api/admin/settings/appearance`,
        {
          headers: { ...headers, "content-type": "application/json" },
          data: {
            websiteTemplate: "blog",
            stylePreset: preset,
            colorMode,
          },
        },
      );
      expect(response.status()).toBe(200);

      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`${publicOrigin}/en/`);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole("main")).toBeVisible();
        await expect(
          page.getByRole("heading", { name: "Latest from the publication" }),
        ).toBeVisible();
        await capture(page, `public-${preset}-${colorMode}-home-${width}`);
        await expectNoAxeViolations(
          page,
          `Public ${preset} ${colorMode} home ${width}`,
        );

        if (width === 390 && colorMode === "light") {
          await page.emulateMedia({ reducedMotion: "reduce" });
          const navigationToggle = page.getByRole("button", {
            name: "Open navigation",
          });
          await navigationToggle.click();
          const navigation = page.getByRole("navigation", {
            name: "Primary",
          });
          await expect(navigation).toBeVisible();
          await expect
            .poll(() =>
              navigation.evaluate(
                (element) => getComputedStyle(element).opacity,
              ),
            )
            .toBe("1");
          const transitionDuration = await navigation.evaluate(
            (element) => getComputedStyle(element).transitionDuration,
          );
          expect(Number.parseFloat(transitionDuration)).toBeLessThanOrEqual(
            0.001,
          );
          await expectNoAxeViolations(page, `Public ${preset} open navigation`);
          await page.keyboard.press("Escape");
          await expect(navigationToggle).toBeFocused();
        }
      }
    }
  }
});
