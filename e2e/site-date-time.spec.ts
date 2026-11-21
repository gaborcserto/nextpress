import {
  ContentRecordSchema,
  EditorialPostSchema,
  EditorialPageSchema,
} from "@nextpress/shared/api-contracts";
import { expect, test, type Page } from "@playwright/test";

const headers = {
  origin: "http://localhost:49201",
  "content-type": "application/json",
};

async function signIn(page: Page) {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
}

async function enterWallTime(page: Page, date: string, time: string) {
  const dateField = page.getByRole("textbox", {
    name: "Publish date",
    exact: true,
  });
  const timeField = page.getByRole("textbox", {
    name: "Publish time",
    exact: true,
  });
  await dateField.fill(date);
  await timeField.fill(time);
  await timeField.press("Tab");
}

test.use({ locale: "en-US", timezoneId: "America/New_York" });

test("renders and schedules in the configured site timezone", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await signIn(page);
  await page.goto("/admin/settings");
  const timezone = page.getByLabel("Site timezone");
  const dateFormat = page.getByLabel("Date format");
  const timeFormat = page.getByLabel("Time format");
  const saveSettings = page.getByRole("button", { name: "Save site settings" });
  await timezone.fill("Europe/Budapest");
  await dateFormat.selectOption("iso");
  await timeFormat.selectOption("24h-seconds");
  await expect(page.getByText("Unsaved date and time changes")).toBeVisible();
  await saveSettings.click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.reload();
  await expect(timezone).toHaveValue("Europe/Budapest");
  await expect(dateFormat).toHaveValue("iso");
  await expect(timeFormat).toHaveValue("24h-seconds");

  for (const [type, kind] of [
    ["POST", "posts"],
    ["PAGE", "pages"],
  ]) {
    const slug = `timezone-${kind}`;
    const resource = type === "POST" ? "post" : "pages";

    const response = await page.request.post(`/api/${resource}`, {
      headers,
      data: {
        type,
        title: `Timezone ${kind}`,
        slug,
        status: "PUBLISHED",
        publishedAt: "2026-01-01T23:30:45.678Z",
      },
    });
    expect(response.status()).toBe(201);
    const { id } = ContentRecordSchema.parse(await response.json());
    await page.goto(`http://localhost:49200/en/${kind}/${slug}`);
    await expect(
      page.locator('time[datetime="2026-01-01T23:30:45.678Z"]'),
    ).toHaveText("2026-01-02, 00:30:45");
    await page.goto(`/admin/${kind}/${id}`);

    if (type === "POST") {
      await enterWallTime(page, "03/29/2026", "02:30");
      await expect(
        page.getByText(/does not exist in the site timezone/),
      ).toBeVisible();
      await enterWallTime(page, "10/25/2026", "02:30");
      await page
        .getByRole("button", { name: /Second occurrence.*UTC/ })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Publish time", exact: true }),
      ).toHaveValue("02:30");
    }

    await enterWallTime(page, "07/21/2099", "14:30");
    const save = page.getByRole("button", {
      name: type === "POST" ? "Save changes" : "Save",
      exact: true,
    });
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText(/(Post|Page) updated\./)).toBeVisible();
    const read = await page.request.get(`/api/${resource}/${id}`);
    expect(read.ok()).toBe(true);
    const { item } = await read.json();

    const saved = (
      type === "POST" ? EditorialPostSchema : EditorialPageSchema
    ).parse(item);
    expect(saved.publishedAt).toBe("2099-07-21T12:30:00.000Z");
    await page.reload();
    await expect(
      page.getByRole("textbox", { name: "Publish time", exact: true }),
    ).toHaveValue("14:30");

    if (type === "POST") {
      await page
        .getByRole("button", { name: "Live Preview", exact: true })
        .click();
      const preview = page.frameLocator(
        'iframe[title="Public frontend preview"]',
      );
      await expect(
        preview.locator('time[datetime="2099-07-21T12:30:00.000Z"]'),
      ).toHaveText("2099-07-21, 14:30:00");
      await page.getByLabel("Unsaved live updates").uncheck();
      await expect(
        page.getByText("Saved preview of authoritative editor content"),
      ).toBeVisible();
      await expect(
        preview.locator('time[datetime="2099-07-21T12:30:00.000Z"]'),
      ).toHaveText("2099-07-21, 14:30:00");

      const mobile = await browser.newContext({
        baseURL: "http://localhost:49201",
        locale: "hu-HU",
        colorScheme: "dark",
        viewport: { width: 375, height: 812 },
        storageState: await page.context().storageState(),
      });

      try {
        const mobilePage = await mobile.newPage();
        await mobilePage.goto(`/admin/posts/${id}`);
        await mobilePage.getByRole("button", { name: /^Theme:/ }).click();
        await mobilePage
          .getByRole("menuitemradio", { name: "Dark", exact: true })
          .click();
        await expect(mobilePage.locator("html")).toHaveAttribute(
          "data-theme",
          "dark",
        );
        await expect(
          mobilePage.getByLabel("Közzététel időpontja", { exact: true }),
        ).toHaveValue("14:30");
        await mobilePage
          .getByRole("button", { name: "Naptár megnyitása" })
          .click();
        await expect(mobilePage.getByRole("dialog")).toBeVisible();
        await mobilePage.keyboard.press("Escape");
        await expect(
          mobilePage.getByRole("button", { name: "Naptár megnyitása" }),
        ).toBeFocused();
      } finally {
        await mobile.close();
      }
    }
  }

  await page.goto("/admin/settings");
  await timezone.fill("Asia/Tokyo");
  await saveSettings.click();
  await expect(page.getByText("Settings saved.")).toBeVisible();
  await page.goto("/admin/posts");
  await expect(
    page.locator('time[datetime="2099-07-21T12:30:00.000Z"]'),
  ).toHaveText("2099-07-21, 21:30:00");
});
