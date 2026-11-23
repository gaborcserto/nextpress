import { expect, test } from "@playwright/test";

import type { Page, Response, TestInfo } from "@playwright/test";

test.use({ baseURL: "http://localhost:49200" });

function recordHydrationErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    errors.push(
      `Request failed: ${url.pathname} (${request.failure()?.errorText})`,
    );
  });

  return errors;
}

async function openLanguageMenu(page: Page, name: string) {
  const trigger = page.getByRole("button", { name, exact: true });
  let readinessAttempts = 0;

  await expect
    .poll(async () => {
      readinessAttempts += 1;

      if ((await trigger.getAttribute("aria-expanded")) === "true") {
        return true;
      }

      await trigger.press("ArrowDown");

      return (await trigger.getAttribute("aria-expanded")) === "true";
    })
    .toBe(true);

  await page.keyboard.press("Escape");
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await trigger.click();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const menu = page.getByRole("menu", { name });
  await expect(menu).toBeVisible();
  const selectedOption = menu.locator(
    '[role="menuitemradio"][aria-checked="true"]',
  );
  await expect(selectedOption).toBeFocused();

  const renderedState = await menu.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      display: style.display,
      visibility: style.visibility,
      ariaHidden: element.getAttribute("aria-hidden"),
      activeOption: document.activeElement?.textContent?.trim() ?? "",
    };
  });

  return { menu, readinessAttempts, renderedState };
}

async function expectServerMenu(response: Response | null) {
  expect(response).not.toBeNull();
  expect(response?.status()).toBe(200);
  const html = await response?.text();
  // Inspect the response, not the recovered DOM: React can regenerate a missing SSR menu.
  expect(html).toMatch(
    /<div[^>]*role="menu"[^>]*data-open="false"[^>]*aria-hidden="true"[^>]*inert=""/,
  );
}

for (const locale of ["en", "hu"] as const) {
  test(`@cross-browser SSR language menu stays consistent through ${locale} language changes and history`, async ({
    page,
    context,
  }, testInfo: TestInfo) => {
    const destination = locale === "en" ? "hu" : "en";
    const errors = recordHydrationErrors(page);
    const navigationPaths: string[] = [];
    page.on("framenavigated", (frame) => {
      navigationPaths.push(new URL(frame.url()).pathname);
    });
    await context.addCookies([
      { name: "np-locale", value: destination, url: "http://localhost:49200" },
      {
        name: "np-color-mode",
        value: locale === "en" ? "dark" : "light",
        url: "http://localhost:49200",
      },
    ]);

    await expectServerMenu(await page.goto(`/${locale}/posts`));
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expectServerMenu(await page.reload());
    const menuName = locale === "en" ? "Language" : "Nyelv";

    const { menu, readinessAttempts, renderedState } = await openLanguageMenu(
      page,
      menuName,
    );

    const response = page.waitForResponse(
      (result) =>
        result.request().isNavigationRequest() &&
        new URL(result.url()).pathname === `/${destination}/posts`,
    );
    await menu
      .getByRole("menuitemradio", {
        name: destination === "hu" ? "Magyar" : "English",
        exact: true,
      })
      .click();
    await expectServerMenu(await response);
    await expect(page.locator("html")).toHaveAttribute("lang", destination);
    await page.goBack();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await page.goForward();
    await expect(page.locator("html")).toHaveAttribute("lang", destination);
    await expectServerMenu(await page.reload());
    console.log(
      "Public language-menu diagnostics",
      JSON.stringify({
        locale,
        readinessAttempts,
        errors,
        navigationPaths,
        expandedAfterOpen: true,
        renderedState,
      }),
    );
    expect(errors).toEqual([]);
    await testInfo.attach("public-language-menu-diagnostics", {
      body: JSON.stringify({ errors, navigationPaths }, null, 2),
      contentType: "application/json",
    });
  });
}

test("published article SSR includes the same closed navigation menu as the client", async ({
  page,
}) => {
  const errors = recordHydrationErrors(page);
  await expectServerMenu(await page.goto("/en/posts"));
  const href = await page
    .locator('main a[href^="/en/posts/"]')
    .first()
    .getAttribute("href");
  test.skip(!href, "No published article is available in this fixture.");

  if (!href) {
    return;
  }

  await expectServerMenu(await page.goto(href));
  await page.getByRole("button", { name: "Language", exact: true }).click();
  const response = page.waitForResponse(
    (result) =>
      result.request().isNavigationRequest() &&
      new URL(result.url()).pathname === href.replace(/^\/en\//, "/hu/"),
  );
  await page
    .getByRole("menuitemradio", { name: "Magyar", exact: true })
    .click();
  await expectServerMenu(await response);
  await expect(page.locator("html")).toHaveAttribute("lang", "hu");
  expect(errors).toEqual([]);
});
