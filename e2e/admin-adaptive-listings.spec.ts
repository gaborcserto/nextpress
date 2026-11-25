import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { expect, test, type Locator, type Page } from "@playwright/test";

const title =
  "Typography and structured content: a public style guide for layout testing (listing fixture)";
const slug = "typography-and-structured-content-" + "unbroken".repeat(10);
const widths = [320, 390, 640, 768, 820, 1024, 1280, 1440, 1920];

async function verifyGeometry(titleLink: Locator) {
  const titleBox = await titleLink.boundingBox();
  expect(titleBox?.width).toBeGreaterThan(0);

  const dimensions = await titleLink.evaluate((link) => {
    const row = link.closest("tr")!;
    const table = link.closest("table")!;
    const surface = table.closest(".admin-adaptive-list")!;
    const toolbar = surface.querySelector(".admin-list-toolbar")!;
    const search = toolbar.querySelector('input[type="search"]')!;
    const actions = Array.from(
      row.querySelectorAll(".admin-table-actions .btn"),
    );
    const badges = Array.from(
      table.querySelectorAll(".admin-table-identity .admin-badge"),
    );
    const bounds = surface.getBoundingClientRect();
    const contained = [
      toolbar,
      search,
      table,
      row,
      link,
      ...actions,
      ...badges,
    ].every((element) => {
      const rect = element.getBoundingClientRect();

      return (
        rect.width > 0 &&
        rect.left >= bounds.left - 1 &&
        rect.right <= bounds.right + 1
      );
    });

    return {
      contained,
      toolbarWidth: toolbar.clientWidth,
      panelWidth: surface.clientWidth,
      overflow: [surface, toolbar, table, row].map(
        (element) => element.scrollWidth - element.clientWidth,
      ),
      dateLines: Array.from(row.querySelectorAll("time > span")).every(
        (part) => getComputedStyle(part).whiteSpace === "nowrap",
      ),
    };
  });

  expect(dimensions.contained).toBe(true);
  expect(dimensions.toolbarWidth).toBe(dimensions.panelWidth);
  expect(Math.max(...dimensions.overflow)).toBeLessThanOrEqual(1);
  expect(dimensions.dateLines).toBe(true);
}

async function saveEvidence(page: Page, name: string) {
  await page.screenshot({
    path: `.notes/admin-redesign/layout-02/${name}.png`,
    animations: "disabled",
    style: "nextjs-portal { display: none; }",
  });
}

test("Posts and Pages adapt to the listing width and expose complete truncated values", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);

  for (const [heading, endpoint] of [
    ["Pages", "/api/pages"],
    ["Posts", "/api/post"],
  ] as const) {
    const response = await page.request.post(endpoint, {
      headers: { origin: "http://localhost:49201" },
      data: {
        title,
        slug: `${heading.toLowerCase()}-${slug}`,
        status: "DRAFT",
        ...(heading === "Pages"
          ? { type: "PAGE", layout: "GALLERY" }
          : { type: "POST", tagIds: [] }),
      },
    });
    expect(response.status(), `Create ${heading} fixture`).toBe(201);

    if (heading === "Pages") {
      const { id } = ContentRecordSchema.parse(await response.json());

      const moved = await page.request.put("/api/admin/page-hierarchy", {
        headers: { origin: "http://localhost:49201" },
        data: {
          id,
          parentId: "dev-seed-page-about",
          siblingOrder: 0,
          previousParentId: null,
          previousSiblingOrder: 0,
        },
      });

      expect(moved.status(), "Nest the gallery below About").toBe(200);
    }
  }

  for (const [name, layout, slug] of [
    ["Home", "HOME", "home"],
    ["Posts", "POSTS", "posts"],
  ]) {
    const response = await page.request.post("/api/pages", {
      headers: { origin: "http://localhost:49201" },
      data: { type: "PAGE", title: name, layout, slug, status: "DRAFT" },
    });
    expect(response.status(), `Create ${name} system page fixture`).toBe(201);
  }

  for (const heading of ["Pages", "Posts"]) {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`/admin/${heading.toLowerCase()}`);
    const table = page.getByRole("table", { name: heading });
    const row = table
      .getByRole("row")
      .filter({ has: page.getByRole("link", { name: title, exact: true }) });
    const titleLink = row.getByRole("link", { name: title, exact: true });
    await expect(titleLink).toBeVisible();
    await expect(
      row.getByRole("button", { name: `Delete ${title}` }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Last modified" }),
    ).toBeVisible();
    await expect(
      table.getByRole("columnheader", { name: "Created" }),
    ).toHaveCount(0);
    await expect(row.getByText("Created:", { exact: false })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sort by" })).toBeVisible();
    await verifyGeometry(titleLink);

    const clipped = titleLink.locator(".admin-ellipsis");
    await expect(clipped).toHaveCSS("text-overflow", "ellipsis");
    expect(
      await clipped.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    await titleLink.focus();
    const tooltip = page.getByRole("tooltip");
    await expect(tooltip).toHaveText(title);
    const tooltipBounds = await tooltip.boundingBox();
    expect(tooltipBounds?.x).toBeGreaterThanOrEqual(0);
    expect(
      (tooltipBounds?.x ?? 0) + (tooltipBounds?.width ?? 0),
    ).toBeLessThanOrEqual(768);
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await titleLink.blur();
    await titleLink.dispatchEvent("pointerdown", { pointerType: "touch" });
    await expect(tooltip).toHaveText(title);
    await titleLink.dispatchEvent("pointerup", { pointerType: "touch" });
    await expect(tooltip).toHaveCount(0);

    const prefix = heading === "Pages" ? "/about-nextpress" : "";
    const expectedPath = `${prefix}/${heading.toLowerCase()}-${slug}`;
    const path = row.getByText(expectedPath, { exact: true });
    await path.focus();
    await expect(tooltip).toHaveText(expectedPath);
    await page.keyboard.press("Escape");
    await expect(tooltip).toHaveCount(0);
    await saveEvidence(page, `${heading.toLowerCase()}-768-light`);

    if (heading === "Pages") {
      const systems = table.getByRole("row").filter({ hasText: "System page" });
      await expect(systems).toHaveCount(2);
      await expect(
        systems.getByRole("button", { name: /^Delete Home$/ }),
      ).toBeDisabled();
      await expect(
        systems.getByRole("button", { name: /^Delete Posts$/ }),
      ).toBeDisabled();
    }

    for (const width of widths) {
      await page.setViewportSize({ width, height: 1024 });
      await verifyGeometry(titleLink);

      if (width === 390 || width === 1440) {
        await saveEvidence(page, `${heading.toLowerCase()}-${width}-light`);
      }

      const collapse = page.getByRole("button", {
        name: "Collapse",
        exact: true,
      });
      const expand = page.getByRole("button", { name: "Expand sidebar" });

      if (await collapse.isVisible()) {
        await collapse.click();
        await expect(expand).toBeVisible();
        await expect(
          page.locator(".admin-sidebar[data-collapsed='true']"),
        ).toBeVisible();
        await verifyGeometry(titleLink);
        await expand.click();
        await expect(collapse).toBeVisible();
      }
    }

    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page
      .getByRole("menuitemradio", { name: "Dark", exact: true })
      .click();
    await page.getByRole("button", { name: "Admin language: English" }).click();
    await page.getByRole("menuitemradio", { name: "Magyar" }).click();

    for (const width of [390, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1024 });
      await verifyGeometry(titleLink);
    }

    await page.setViewportSize({ width: 768, height: 1024 });
    await saveEvidence(page, `${heading.toLowerCase()}-768-hu-dark`);
    await page.getByRole("button", { name: "Admin nyelve: Magyar" }).click();
    await page.getByRole("menuitemradio", { name: "English" }).click();
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page
      .getByRole("menuitemradio", { name: "Light", exact: true })
      .click();
  }
});
