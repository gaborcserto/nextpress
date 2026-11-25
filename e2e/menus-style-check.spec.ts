import { expect, test } from "@playwright/test";

const adminOrigin = "http://localhost:49201";
const requestHeaders = {
  origin: adminOrigin,
  "content-type": "application/json",
};

test("renders menu toggle colors, alignment, and rounded page option hover", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });

  const title =
    "Long browser menu title that must truncate within the available picker width";
  const pageResponse = await page.request.post("/api/pages", {
    headers: requestHeaders,
    data: {
      type: "PAGE",
      title,
      slug: "menu-style-check-page",
      layout: "STANDARD",
      status: "PUBLISHED",
    },
  });

  expect(pageResponse.status()).toBe(201);

  await page.goto("/admin/settings/menus");
  await expect(
    page.getByRole("heading", { name: "Menus", exact: true }),
  ).toBeVisible();

  const pageOption = page.locator("label").filter({ hasText: title });
  await expect(pageOption).toBeVisible();
  await pageOption.hover();

  const hoverStyle = await pageOption.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
    };
  });

  expect(hoverStyle.borderRadius).toBe("4px");
  expect(hoverStyle.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");

  const pageCheckbox = pageOption.getByRole("checkbox", { name: title });
  await pageCheckbox.focus();

  const focusStyle = await pageOption.evaluate((element) => {
    const style = getComputedStyle(element);

    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
    };
  });

  expect(focusStyle.backgroundColor).toBe(hoverStyle.backgroundColor);
  expect(focusStyle.borderRadius).toBe("4px");
  await page.getByRole("button", { name: "Custom link", exact: true }).click();

  const item = page.locator("[data-menu-item-id]").last();
  await item.locator("details > summary").click();

  const toggle = item.getByRole("checkbox", {
    name: "Open in new tab",
    exact: true,
  });
  const select = item.locator(".admin-select-trigger select");
  const toggleLabel = toggle.locator("xpath=..", {});

  const alignment = await Promise.all([
    select.boundingBox(),
    toggleLabel.boundingBox(),
  ]);
  const selectBounds = alignment[0];
  const toggleBounds = alignment[1];

  if (!selectBounds || !toggleBounds) {
    throw new Error("Parent select or toggle has no rendered bounds");
  }

  const centerOffset = Math.abs(
    selectBounds.y +
      selectBounds.height / 2 -
      (toggleBounds.y + toggleBounds.height / 2),
  );

  expect(centerOffset).toBeLessThanOrEqual(1);

  async function expectToggleColors(theme: "light" | "dark") {
    async function pixelFor(cssColor: string) {
      return page.evaluate((color) => {
        const context = document.createElement("canvas").getContext("2d");

        if (!context) {
          throw new Error("Unable to create a canvas color context");
        }

        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);

        return Array.from(context.getImageData(0, 0, 1, 1).data);
      }, cssColor);
    }

    async function tokenPixel(tokenName: string) {
      const cssColor = await toggle.evaluate((element, token) => {
        const probe = document.createElement("div");
        document.body.append(probe);
        probe.style.backgroundColor = `var(${token})`;
        const color = getComputedStyle(probe).backgroundColor;
        probe.remove();

        return color;
      }, tokenName);

      return pixelFor(cssColor);
    }

    async function actualPixel(pseudo?: string) {
      const cssColor = await toggle.evaluate(
        (element, pseudoElement) =>
          getComputedStyle(element, pseudoElement).backgroundColor,
        pseudo ?? null,
      );

      return pixelFor(cssColor);
    }

    const primaryPixel = await tokenPixel("--color-primary");
    const neutralPixel = await tokenPixel("--field-border");
    const whitePixel = await tokenPixel("--palette-white");

    await toggle.check();

    await expect.poll(() => actualPixel()).toEqual(primaryPixel);
    expect(await actualPixel("::before"), `${theme} checked thumb`).toEqual(
      whitePixel,
    );

    const bounds = await toggle.boundingBox();

    if (!bounds) {
      throw new Error("Toggle has no rendered bounds");
    }

    expect(bounds.width).toBeGreaterThanOrEqual(36);
    expect(bounds.width).toBeLessThanOrEqual(40);
    expect(bounds.height).toBeGreaterThanOrEqual(20);
    expect(bounds.height).toBeLessThanOrEqual(22);

    await toggle.uncheck();

    await expect.poll(() => actualPixel()).toEqual(neutralPixel);
    expect(await actualPixel("::before"), `${theme} unchecked thumb`).toEqual(
      whitePixel,
    );
  }

  await page.emulateMedia({ colorScheme: "light" });
  await expectToggleColors("light");

  const themeButton = page.getByRole("button", { name: /^Theme:/ });
  await themeButton.click();
  await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectToggleColors("dark");

  await toggle.check();
  await pageOption.hover();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: ".notes/admin-redesign/menus-targeted-visual-check.png",
    fullPage: true,
  });
});
