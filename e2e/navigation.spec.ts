import {
  ContentRecordSchema,
  NavigationMenuListSchema,
} from "@nextpress/shared/api-contracts";
import { expect, test } from "@playwright/test";

const web = "http://localhost:49200";
const headers = {
  origin: "http://localhost:49201",
  "content-type": "application/json",
};

test("publishes nested Page links through the managed header", async ({
  page,
  request,
}, testInfo) => {
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (/hydration|did not match/i.test(error.message)) {
      hydrationErrors.push(error.message);
    }
  });

  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });

  async function createPage(slug: string, title: string) {
    const response = await page.request.post("/api/pages", {
      headers,
      data: {
        type: "PAGE",
        slug,
        title,
        layout: "STANDARD",
        status: "PUBLISHED",
      },
    });

    expect(response.status()).toBe(201);

    return ContentRecordSchema.parse(await response.json());
  }

  const parent = await createPage("nav-company", "Navigation Company");
  const child = await createPage("nav-team", "Navigation Team");

  await page.goto(`/admin/pages/${child.id}`);
  await page.getByText("Page hierarchy", { exact: true }).click();
  await page.getByLabel("Parent Page").selectOption(parent.id);
  await page.getByRole("button", { name: "Save hierarchy" }).click();
  await expect(page.getByText("Page hierarchy saved.")).toBeVisible();

  const response = await page.request.get("/api/admin/navigation");

  const menu = NavigationMenuListSchema.parse(await response.json()).find(
    ({ locations }) => locations.includes("header"),
  );

  if (!menu) {
    throw new Error("Missing migrated header");
  }

  const releaseHeader = await page.request.post("/api/admin/navigation", {
    headers,
    data: {
      action: "update",
      id: menu.id,
      version: menu.version,
      menu: { name: menu.name, locations: [], items: menu.items },
    },
  });
  expect(releaseHeader.status()).toBe(200);

  const saved = await page.request.post("/api/admin/navigation", {
    headers,
    data: {
      action: "create",
      menu: {
        name: "Managed Header",
        locations: menu.locations,
        items: [
          ...menu.items,
          {
            id: "company",
            label: "Company links",
            value: "",
            parentId: null,
            kind: "group",
            newTab: false,
          },
        ],
      },
    },
  });
  expect(saved.status()).toBe(201);

  await page.goto("/admin/settings/menus");
  await page
    .getByLabel("Menu", { exact: true })
    .selectOption({ label: "Managed Header" });
  await page.getByRole("button", { name: "Add item" }).click();
  await page
    .getByLabel("Page or Post")
    .last()
    .selectOption({ label: child.title });
  const parentItem = page.getByLabel("Parent item").last();
  await parentItem.selectOption("company");
  await expect(parentItem).toBeFocused();
  await expect(page.getByRole("status")).toContainText("Item level changed.");

  await page.getByRole("button", { name: "Add item" }).click();
  await page.getByLabel("Destination type").last().selectOption("external");
  await page.getByLabel("Item label").last().fill("Navigation example");
  await page.getByLabel("Link URL").last().fill("https://example.com");
  await page.getByLabel("Open in new tab").last().check();
  await page.getByRole("button", { name: "Move up" }).last().click();
  await expect(page.getByRole("status")).toContainText(
    "Moved Navigation example up",
  );
  const externalItem = page
    .locator("li")
    .filter({
      has: page.locator(
        'input[aria-label="Item label"][value="Navigation example"]',
      ),
    })
    .last();
  await externalItem.getByRole("button", { name: "Move down" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText(
    "Moved Navigation example down",
  );
  await page.getByRole("button", { name: "Save menu" }).click();
  await expect(page.getByRole("status")).toContainText("Menu saved.");

  for (const mode of ["Light", "Dark"]) {
    await page.getByRole("button", { name: /^Theme:/ }).click();
    await page.getByRole("menuitemradio", { name: mode, exact: true }).click();
    await expect(
      page.getByRole("button", { name: `Theme: ${mode}` }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add item" })).toBeVisible();
  }

  const menuList = await page.request.get("/api/admin/navigation");

  const footer = NavigationMenuListSchema.parse(await menuList.json()).find(
    ({ locations }) => locations.includes("footer"),
  );

  if (!footer) {
    throw new Error("Missing migrated footer");
  }

  const releaseFooter = await page.request.post("/api/admin/navigation", {
    headers,
    data: {
      action: "update",
      id: footer.id,
      version: footer.version,
      menu: { name: footer.name, items: footer.items, locations: [] },
    },
  });
  expect(releaseFooter.status()).toBe(200);

  const auxiliary = await page.request.post("/api/admin/navigation", {
    headers,
    data: {
      action: "create",
      menu: {
        name: "Auxiliary navigation",
        locations: ["footer", "sidebar"],
        items: [
          {
            id: "aux",
            label: "Auxiliary link",
            value: "/posts",
            parentId: null,
            kind: "internal",
            newTab: false,
          },
        ],
      },
    },
  });
  expect(auxiliary.status()).toBe(201);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${web}/en/nav-company/nav-team`);
  await expect(page.getByRole("heading", { name: child.title })).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "Auxiliary link" }),
  ).toHaveAttribute("href", "/en/posts");
  const externalLink = page.getByRole("link", { name: "Navigation example" });
  await expect(externalLink).toHaveAttribute("target", "_blank");
  await expect(externalLink).toHaveAttribute("rel", "noopener noreferrer");
  const disclosure = page.getByText("Company links", { exact: true });

  await disclosure.focus();
  await page.keyboard.press("Enter");
  const nestedLink = page.getByRole("link", { name: child.title });

  await expect(nestedLink).toHaveAttribute("aria-current", "page");
  await nestedLink.focus();
  await page.keyboard.press("Escape");
  await expect(disclosure).toBeFocused();
  await expect(nestedLink).toBeHidden();

  for (const width of [320, 390, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    );

    expect(overflow).toBe(false);
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: /open navigation/i }).click();
  await disclosure.click();
  await expect(nestedLink).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nestedLink).toBeHidden();

  for (const preset of ["classic", "modern", "minimal"]) {
    const appearance = await page.request.put(
      "/api/admin/settings/appearance",
      {
        headers,
        data: {
          websiteTemplate: "blog",
          stylePreset: preset,
          colorMode: "light",
        },
      },
    );
    expect(appearance.status()).toBe(200);

    await page.goto(`${web}/hu/nav-company/nav-team`);
    await expect(
      page.getByRole("heading", { name: child.title }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "hu");
    await expect(page.locator("html")).toHaveAttribute(
      "data-style-preset",
      preset,
    );
    await expect(
      page.getByRole("navigation", { name: "Oldalsáv" }),
    ).toHaveCount(preset === "minimal" ? 1 : 0);

    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const documentWidth = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(documentWidth, `${preset} Page at ${width}px`).toBeLessThanOrEqual(
        width,
      );

      if (width === 390 || width === 1440) {
        await page.screenshot({
          path: testInfo.outputPath(`${preset}-hu-page-${width}.png`),
          style: "nextjs-portal { display: none; }",
        });
      }
    }
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/admin/pages/${child.id}`);
  await page.getByRole("button", { name: "Live Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Public frontend preview"]');
  const previewFooter = preview.getByRole("navigation", { name: "Footer" });

  await expect(
    page.getByText("Live preview of unsaved editor values"),
  ).toBeVisible();
  await expect(
    previewFooter.getByRole("link", { name: "Auxiliary link" }),
  ).toBeVisible();
  await page.getByLabel("Unsaved live updates").uncheck();
  await expect(
    page.getByText("Saved preview of authoritative editor content"),
  ).toBeVisible();
  await expect(
    previewFooter.getByRole("link", { name: "Auxiliary link" }),
  ).toBeVisible();

  const cyclicMove = await page.request.put("/api/admin/page-hierarchy", {
    headers,
    data: {
      id: parent.id,
      parentId: child.id,
      siblingOrder: 0,
      previousParentId: null,
      previousSiblingOrder: 0,
    },
  });
  expect(cyclicMove.status()).toBe(400);

  const moves = await Promise.all(
    [1, 2].map((siblingOrder) =>
      page.request.put("/api/admin/page-hierarchy", {
        headers,
        data: {
          id: child.id,
          parentId: null,
          siblingOrder,
          previousParentId: parent.id,
          previousSiblingOrder: 0,
        },
      }),
    ),
  );
  expect(moves.map((response) => response.status()).sort()).toEqual([200, 409]);
  expect((await request.get(`${web}/en/nav-company/nav-team`)).status()).toBe(
    404,
  );
  expect((await request.get(`${web}/en/nav-team`)).status()).toBe(200);

  const anonymous = await request.put(
    "http://localhost:49202/api/admin/page-hierarchy",
    {
      headers,
      data: {
        id: child.id,
        parentId: null,
        siblingOrder: 0,
        previousParentId: parent.id,
        previousSiblingOrder: 0,
      },
    },
  );
  expect(anonymous.status()).toBe(401);
  expect(hydrationErrors).toEqual([]);
});
