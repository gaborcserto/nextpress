import { expect, test, type Locator, type Page } from "@playwright/test";

const widths = [1440, 820, 390];

async function measureButton(button: Locator) {
  const geometry = await button.evaluate((element) => {
    const group =
      element.querySelector(
        '.admin-async-button-state:not([aria-hidden="true"])',
      ) ?? element;

    const [icon, label] = Array.from(group.childNodes)
      .filter((node) => node instanceof Element || node.textContent?.trim())
      .map((node) => {
        const range = document.createRange();
        range.selectNode(node);

        return range.getBoundingClientRect();
      });

    if (!icon || !label) {
      throw new Error("Expected an icon or spinner beside the label");
    }

    const box = element.getBoundingClientRect();
    const centerY = (box.top + box.bottom) / 2;

    return {
      size: { width: box.width, height: box.height },
      horizontal: Math.abs(
        (box.left + box.right - icon.left - label.right) / 2,
      ),
      iconVertical: Math.abs((icon.top + icon.bottom) / 2 - centerY),
      labelVertical: Math.abs((label.top + label.bottom) / 2 - centerY),
      gap: label.left - icon.right,
      expectedGap: parseFloat(getComputedStyle(group).columnGap),
    };
  });

  expect(geometry.horizontal).toBeLessThanOrEqual(1);
  expect(geometry.iconVertical).toBeLessThanOrEqual(2);
  expect(geometry.labelVertical).toBeLessThanOrEqual(2);
  expect(geometry.gap).toBeCloseTo(geometry.expectedGap, 0);

  return geometry.size;
}

async function holdSubmission(page: Page, endpoint: string) {
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });

  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();

      return;
    }

    await pending;
    await route.fulfill({
      status: 409,
      json: { error: "Disposable alignment check" },
    });
  });

  return release;
}

test("centers Menus Save and Cancel across widths and keeps Save stable while pending", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const auth = await page.request.post("/api/auth/sign-in/email", {
    headers: { origin: "http://localhost:49201" },
    data: {
      email: "admin@example.invalid",
      password: "Disposable browser passphrase 2026",
    },
  });
  expect(auth.status()).toBe(200);

  await page.goto("/admin/settings/menus");
  await expect(
    page.getByRole("heading", { name: "Menus", exact: true }),
  ).toBeVisible({ timeout: 30_000 });

  for (const { theme, saveLabel, cancelLabel } of [
    { theme: "Light", saveLabel: "Save", cancelLabel: "Cancel" },
    { theme: "Dark", saveLabel: "Mentés", cancelLabel: "Mégse" },
  ]) {
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
    const save = page.getByRole("button", { name: saveLabel, exact: true });
    const cancel = page.getByRole("button", { name: cancelLabel, exact: true });
    const idleSizes = [];

    await expect(save).toBeDisabled();

    for (const width of widths) {
      await page.setViewportSize({ width, height: 1024 });
      idleSizes.push(await measureButton(save));
      await measureButton(cancel);
    }

    await page.locator("#menu-add-item").click();
    await expect(save).toBeEnabled();

    for (const [index, width] of widths.entries()) {
      await page.setViewportSize({ width, height: 1024 });
      await save.focus();
      await save.hover();
      expect(await measureButton(save)).toEqual(idleSizes[index]);
      await measureButton(cancel);
    }

    const release = await holdSubmission(page, "**/api/admin/navigation");

    try {
      await save.click();
      await expect(save).toHaveAttribute("aria-busy", "true");
      await expect(save).toBeDisabled();
      await expect(save.locator(".loading-spinner")).toBeVisible();

      for (const [index, width] of widths.entries()) {
        await page.setViewportSize({ width, height: 1024 });
        expect(await measureButton(save)).toEqual(idleSizes[index]);
      }
    } finally {
      release();
    }

    await expect(save).toBeEnabled();
    await page.unroute("**/api/admin/navigation");
    await cancel.click();

    if (theme === "Light") {
      await page
        .getByRole("button", { name: "Admin language: English" })
        .click();
      await page.getByRole("menuitemradio", { name: "Magyar" }).click();
    }
  }

  await page.goto("/admin/posts/new");
  await page
    .getByRole("textbox", { name: /^Title/ })
    .fill("Button alignment fixture");
  await page
    .getByRole("textbox", { name: /^Slug/ })
    .fill("button-alignment-fixture");
  await page
    .locator('[contenteditable="true"]')
    .last()
    .pressSequentially("Disposable editor content");
  const submit = page.locator(".admin-editor-submit");
  const idle = await measureButton(submit);
  const release = await holdSubmission(page, "**/api/post");

  try {
    await submit.click();
    await expect(submit).toHaveAccessibleName("Mentés...");
    await expect(submit).toHaveAttribute("aria-busy", "true");
    expect(await measureButton(submit)).toEqual(idle);
  } finally {
    release();
  }

  await expect(submit).toBeEnabled();
});
