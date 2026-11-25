import { expect, test } from "@playwright/test";

test("Settings tabs preserve drafts and save changes through one endpoint", async ({
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
  await page.goto("/admin/settings#settings-appearance");

  const tabs = page.getByRole("tablist", { name: "Settings sections" });
  const general = tabs.getByRole("tab", { name: "General" });
  const publishing = tabs.getByRole("tab", { name: "Publishing" });
  const authentication = tabs.getByRole("tab", { name: "Authentication" });
  const appearanceSection = page.locator("#settings-appearance");
  const batch = page.getByRole("spinbutton", {
    name: "Posts per page / batch",
  });
  const siteName = page.getByRole("textbox", { name: "Site name" });
  const saveChanges = page.getByRole("button", {
    name: "Save changes",
    exact: true,
  });

  await expect(general).toHaveAttribute("aria-selected", "true");
  await expect(tabs.getByRole("tab", { name: "Appearance" })).toHaveCount(0);
  await expect(appearanceSection).toBeInViewport();
  await publishing.click();
  await expect(page).toHaveURL(/#settings-publishing$/);
  await page.goBack();
  await expect(general).toHaveAttribute("aria-selected", "true");
  await expect(appearanceSection).toBeInViewport();
  await page.goForward();

  await expect(publishing).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Publishing");
  await batch.fill("51");
  await publishing.press("Home");
  await expect(general).toBeFocused();
  await expect(general).toHaveCSS("outline-style", "solid");
  await expect(publishing).toHaveAttribute("aria-selected", "true");
  await general.press("Enter");
  await siteName.fill("Settings navigation fixture");
  await saveChanges.click();
  await expect(batch).toBeFocused();
  await expect(page).toHaveURL(/#settings-publishing$/);
  await batch.fill("12");
  await page.goBack();
  await expect(siteName).toHaveValue("Settings navigation fixture");
  await page.goForward();
  await expect(batch).toHaveValue("12");

  await publishing.press("ArrowRight");
  await expect(authentication).toBeFocused();
  await authentication.press("Space");
  const provider = page.locator("summary").filter({ hasText: /github/i });
  await provider.press("Enter");
  const secret = page.getByLabel("github new secret");
  await expect(secret).toBeVisible();
  await secret.fill("disposable-unsaved-fixture");
  await provider.press("Enter");
  await general.click();
  const variant = page.getByRole("combobox", { name: "Style variant" });
  await variant.selectOption("modern");
  await authentication.click();
  await provider.press("Enter");
  await expect(secret).toHaveValue("disposable-unsaved-fixture");
  await secret.clear();
  await provider.press("Enter");
  await general.click();
  await expect(variant).toHaveValue("modern");
  await expect(saveChanges).toBeVisible();

  const putRequests: Array<{ path: string; body: unknown }> = [];
  page.on("request", (request) => {
    if (request.method() === "PUT") {
      putRequests.push({
        path: new URL(request.url()).pathname,
        body: request.postDataJSON(),
      });
    }
  });

  await page.route(
    "**/api/admin/settings",
    (route) =>
      route.fulfill({ status: 503, json: { message: "Fixture failure" } }),
    { times: 1 },
  );
  await saveChanges.click();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    /Your edits are preserved/,
  );
  await expect(siteName).toHaveValue("Settings navigation fixture");
  expect(putRequests).toHaveLength(1);
  expect(putRequests[0]?.path).toBe("/api/admin/settings");
  expect(putRequests[0]?.body).toMatchObject({
    siteName: "Settings navigation fixture",
    postsPerPage: 12,
    appearance: {
      websiteTemplate: "blog",
      stylePreset: "modern",
    },
  });
  await saveChanges.click();
  await expect(
    page.getByRole("status").filter({ hasText: "Settings saved." }),
  ).toBeVisible();
  expect(putRequests).toHaveLength(2);
  expect(putRequests.every(({ path }) => path === "/api/admin/settings")).toBe(
    true,
  );
  await page.reload();
  await expect(siteName).toHaveValue("Settings navigation fixture");
  await publishing.click();
  await expect(batch).toHaveValue("12");
  await general.click();
  await expect(variant).toHaveValue("modern");

  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: theme, exact: true }).click();

    for (const width of [390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });

      for (const tab of [general, publishing, authentication]) {
        await tab.click();
        await expect(page.getByRole("tabpanel")).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);

        if (width === 390 || width === 1440) {
          await page.screenshot({
            path: `.notes/admin-redesign/screenshots-admin0341/${theme}-${width}-${await tab.textContent()}.png`,
            style: "nextjs-portal { display: none; }",
            fullPage: tab === general,
          });
        }
      }
    }
  }

  await page.setViewportSize({ width: 390, height: 740 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
    const tab = document.getElementById("settings-authentication-tab");

    if (tab) {
      tab.textContent = "Hitelesítési és bejelentkezési beállítások";
    }
  });
  await tabs.locator("#settings-authentication-tab").press("Home");
  await expect(general).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
