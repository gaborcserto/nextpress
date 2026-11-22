import { OAUTH_PROVIDERS } from "@nextpress/shared/oauth-providers";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import type { Page } from "@playwright/test";

const origin = "http://localhost:49200";
const headers = { origin: "http://localhost:49201" };
let articleSlug = "";

async function openPrimaryNavigation(page: Page) {
  const toggle = page.getByRole("button", {
    name: "Open navigation",
    exact: true,
  });

  if (await toggle.isVisible()) {
    await toggle.click();
  }

  return page.getByRole("navigation", { name: "Primary", exact: true });
}

test.beforeAll(async ({ request }) => {
  const database = new URL(process.env.DATABASE_URL ?? "");

  if (
    database.hostname !== "localhost" ||
    database.port !== "55441" ||
    database.pathname !== "/nextpress_e2e"
  ) {
    throw new Error("Public layout fixtures require the disposable E2E runner");
  }

  const login = await request.post(
    "http://localhost:49201/api/auth/sign-in/email",
    {
      headers,
      data: {
        email: "admin@example.invalid",
        password: "Disposable browser passphrase 2026",
      },
    },
  );
  expect(login.status()).toBe(200);
  const fixtureId = randomUUID();
  articleSlug = `responsive-archive-${fixtureId}-0`;

  for (let index = 0; index < 6; index++) {
    const created = await request.post("http://localhost:49201/api/post", {
      headers,
      data: {
        type: "POST",
        status: "PUBLISHED",
        title: `Responsive archive fixture ${index}: publication layout and navigation`,
        slug: `responsive-archive-${fixtureId}-${index}`,
        tagIds: [],
      },
    });
    expect(created.status()).toBe(201);
  }

  const settings = await request.put(
    "http://localhost:49201/api/admin/settings",
    {
      headers,
      data: {
        siteName: "Disposable publication",
        siteDescription: "Responsive browser acceptance",
        siteUrl: origin,
        ogImageUrl: "",
        defaultUserRole: "SUBSCRIBER",
        postListingMode: "PAGINATION",
        postsPerPage: 4,
        oauthProviders: OAUTH_PROVIDERS.map((provider) => ({
          provider,
          enabled: false,
          clientId: "",
        })),
      },
    },
  );
  expect(settings.status()).toBe(200);
});

for (const preset of ["classic", "modern", "minimal"] as const) {
  test(`${preset} routes reflow at supported widths with settled navigation`, async ({
    page,
  }, testInfo) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("http://localhost:49201/auth/sign-in");
    await page
      .getByLabel("Email", { exact: true })
      .fill("admin@example.invalid");
    await page
      .getByLabel("Password", { exact: true })
      .fill("Disposable browser passphrase 2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });

    const appearance = await page.request.put(
      "http://localhost:49201/api/admin/settings/appearance",
      {
        headers: { ...headers, "content-type": "application/json" },
        data: {
          websiteTemplate: "blog",
          stylePreset: preset,
          colorMode: "light",
        },
      },
    );
    expect(appearance.status()).toBe(200);

    for (const route of ["home", "archive", "article"] as const) {
      const path =
        route === "home"
          ? "/en/"
          : route === "archive"
            ? "/en/posts"
            : `/en/posts/${articleSlug}`;

      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect((await page.goto(`${origin}${path}`))?.status()).toBe(200);
        await page.evaluate(() => document.fonts.ready);
        await expect(page.getByRole("main")).toBeVisible();

        const dimensions = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
        }));
        expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);

        await page.locator("html").evaluate((html) => {
          html.style.fontSize = "200%";
        });
        const resizedGeometry = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          viewport: window.innerWidth,
          overflowing: Array.from(document.body.querySelectorAll("*"))
            .filter((element) => {
              const bounds = element.getBoundingClientRect();

              return bounds.right > window.innerWidth + 1;
            })
            .slice(0, 5)
            .map((element) => ({
              tag: element.tagName,
              className: element.getAttribute("class"),
              text: element.textContent?.trim().slice(0, 40),
              width: Math.round(element.getBoundingClientRect().width),
              right: Math.round(element.getBoundingClientRect().right),
            })),
        }));
        console.log(JSON.stringify({ preset, route, width, resizedGeometry }));
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
          .toBeLessThanOrEqual(width);
        await page.locator("html").evaluate((html) => {
          html.style.fontSize = "";
        });

        if (width < 896) {
          const toggle = page.getByRole("button", { name: /navigation/i });

          await toggle.click();
          await expect(toggle).toHaveAttribute("aria-expanded", "true");
          await page.waitForTimeout(250);

          if (width === 390) {
            await page.screenshot({
              path: testInfo.outputPath(`${route}-390-open.png`),
              fullPage: true,
            });
          }

          await page.keyboard.press("Escape");
          await expect(toggle).toHaveAttribute("aria-expanded", "false");
          await expect(toggle).toBeFocused();
          await page.waitForTimeout(250);
        }

        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
        await page.emulateMedia({ reducedMotion: "no-preference" });

        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: testInfo.outputPath(`${route}-${width}-closed.png`),
            fullPage: true,
          });
        }
      }
    }

    expect(pageErrors).toEqual([]);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`public archive layout, resources and navigation at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 852 });
    const warnings: string[] = [];
    const developmentMessages: string[] = [];
    const pageErrors: string[] = [];
    const resourceFailures: string[] = [];
    const chunks: { url: string; status: number }[] = [];
    page.on("console", (message) => {
      if (/\[Fast Refresh\]|\[HMR\]/.test(message.text())) {
        developmentMessages.push(message.text());
      }

      if (["warning", "error"].includes(message.type())) {
        warnings.push(message.text());
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/_next/static/")) {
        chunks.push({ url: response.url(), status: response.status() });

        if (response.status() >= 400) {
          resourceFailures.push(response.url());
        }
      }
    });
    page.on("requestfailed", (request) => {
      if (
        request.url().includes("/_next/static/") &&
        request.failure()?.errorText !== "net::ERR_ABORTED"
      ) {
        resourceFailures.push(
          `${request.url()}: ${request.failure()?.errorText}`,
        );
      }
    });

    expect((await page.goto(`${origin}/en/posts`))?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Posts", exact: true }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute(
      "data-scroll-behavior",
      "smooth",
    );
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "smooth");
    const primary = await openPrimaryNavigation(page);
    await primary.getByRole("link", { name: "Posts", exact: true }).focus();
    await expect(page.locator(":focus")).toHaveText("Posts");
    await page.keyboard.press("Escape");
    // Chrome reports unused preloads several seconds after load; retain that observation window.
    await page.waitForTimeout(6500);
    const geometry = await page.evaluate(() => ({
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      preloads: Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="preload"]'),
      ).map((link) => ({ href: link.href, as: link.as })),
      scripts: Array.from(document.scripts)
        .map((script) => script.src)
        .filter(Boolean),
    }));
    expect(geometry.document).toBeLessThanOrEqual(width);
    expect(geometry.body).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath("posts.png"),
      fullPage: true,
    });

    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
    );
    await page.getByRole("link", { name: "Next page", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/en/posts?page=2`);
    // Next preserves the scroll position when the destination is already visible.
    await expect(
      page.getByRole("heading", { name: "Posts", exact: true }),
    ).toBeInViewport();
    await page
      .getByRole("link", { name: "Previous page", exact: true })
      .click();
    await expect(page).toHaveURL(`${origin}/en/posts`);
    const navigation = await openPrimaryNavigation(page);
    await navigation.getByRole("link", { name: "Home", exact: true }).click();
    await expect(page).toHaveURL(`${origin}/en/`);
    await (
      await openPrimaryNavigation(page)
    )
      .getByRole("link", { name: "Posts", exact: true })
      .click();
    await expect(page).toHaveURL(`${origin}/en/posts`);
    await page
      .getByRole("link", { name: /^Responsive archive fixture/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/posts\/responsive-archive-/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Responsive archive fixture",
    );
    await page.goBack();
    await expect(page).toHaveURL(`${origin}/en/posts`);
    await page.reload();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "Skip to main content" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
    await page.waitForTimeout(6500);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    expect(pageErrors).toEqual([]);
    expect(resourceFailures).toEqual([]);
    expect(
      warnings.filter((message) => message.includes("data-scroll-behavior")),
    ).toEqual([]);
    expect(chunks.length).toBeGreaterThan(0);

    if (process.env.NEXTPRESS_E2E_WEB_PRODUCTION === "1") {
      expect(developmentMessages).toEqual([]);
    }

    const observations = testInfo.outputPath("resource-observations.json");
    await writeFile(
      observations,
      JSON.stringify(
        {
          mode:
            process.env.NEXTPRESS_E2E_WEB_PRODUCTION === "1"
              ? "production"
              : "development",
          width,
          geometry,
          warnings,
          developmentMessages,
          pageErrors,
          resourceFailures,
          chunks,
        },
        null,
        2,
      ),
    );
    await testInfo.attach("public-resource-observations", {
      path: observations,
      contentType: "application/json",
    });
    console.log(
      JSON.stringify({
        width,
        warnings,
        failedResources: resourceFailures.length,
        chunkResponses: chunks.length,
      }),
    );
  });
}
