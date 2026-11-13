import { expect, test } from "@playwright/test";

import type { Page, Response } from "@playwright/test";

test.use({ baseURL: "http://localhost:49200" });

function recordHydrationErrors(page: Page) {
  const errors: string[] = [];

  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydrat|server rendered|didn't match/i.test(message.text())
    ) {
      errors.push(message.text());
    }
  });

  return errors;
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
  test(`SSR language menu stays consistent through ${locale} language changes and history`, async ({
    page,
    context,
  }) => {
    const destination = locale === "en" ? "hu" : "en";
    const errors = recordHydrationErrors(page);
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
    const trigger = page.getByRole("button", {
      name: locale === "en" ? "Language" : "Nyelv",
      exact: true,
    });
    const response = page.waitForResponse(
      (result) =>
        result.request().isNavigationRequest() &&
        new URL(result.url()).pathname === `/${destination}/posts`,
    );
    await trigger.click();
    await page
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
    expect(errors).toEqual([]);
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
