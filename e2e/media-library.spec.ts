import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { MediaCollectionSchema } from "@nextpress/shared/media";
import { expect, test, type Page } from "@playwright/test";

test.setTimeout(120_000);

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAIAAADwyuo0AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEklEQVQImWP4z8AARwjWfwYGAG+qB/l/O6VpAAAAAElFTkSuQmCC",
  "base64",
);
const web = "http://localhost:49200";
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
  await expect(page).not.toHaveURL(/sign-in/, { timeout: 30_000 });
}

test("uploads media, edits metadata and browses the same assets on desktop and mobile", async ({
  page,
  browser,
  request,
}) => {
  await signIn(page);
  await page
    .getByRole("link", { name: "Media Library", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Media Library" }),
  ).toBeVisible({ timeout: 30_000 });
  await page.getByLabel("Upload images").setInputFiles([
    { name: "Árvíztűrő.png", mimeType: "image/png", buffer: png },
    { name: "Disposable.png", mimeType: "image/png", buffer: png },
    {
      name: "Invalid.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    },
  ]);

  await expect(page.getByText("Uploaded", { exact: true })).toHaveCount(2);
  await expect(
    page.getByText("Upload failed. Check the file or try again."),
  ).toBeVisible();
  await page.getByLabel("Search media").fill("Árvíztűrő");
  await page.getByLabel("Original format").selectOption("image/png");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("button", { name: /Árvíztűrő\.png/ }).click();
  const details = page.getByRole("dialog", { name: "Media details" });
  await details.getByLabel("Alternative text").fill("Őszi táj");
  await details.getByLabel("Caption", { exact: true }).fill("Téli árnyék");
  await details
    .getByLabel("Description", { exact: true })
    .fill("Részletes leírás");
  await details.getByRole("button", { name: "Save metadata" }).click();
  await expect(details.getByText("Metadata saved.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(details).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Search media")).toHaveValue("Árvíztűrő");

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Media Library" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }

  const cookies = await page.context().cookies();

  const mobile = await browser.newContext({
    locale: "hu-HU",
    viewport: { width: 390, height: 844 },
    colorScheme: "dark",
  });

  try {
    await mobile.addCookies([
      ...cookies,
      { name: "theme", value: "dark", url: "http://localhost:49201" },
    ]);
    const localized = await mobile.newPage();
    await localized.goto("http://localhost:49201/admin/media");
    await expect(
      localized.getByRole("heading", { name: "Médiatár" }),
    ).toBeVisible();
    await localized
      .getByRole("button", { name: "Árvíztűrő.png", exact: true })
      .press("Enter");
    await expect(localized.getByLabel("Helyettesítő szöveg")).toHaveValue(
      "Őszi táj",
    );
    await expect(localized.getByLabel("Képaláírás")).toHaveValue("Téli árnyék");
    expect(
      await localized.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390);
  } finally {
    await mobile.close();
  }

  const anonymous = await request.get("/api/media/library");
  expect(anonymous.status()).toBe(401);
  await page.goto("/admin/media");
  await page
    .getByRole("button", { name: "Disposable.png", exact: true })
    .click();
  await details.getByRole("button", { name: "Delete asset" }).click();
  await page
    .getByRole("dialog", { name: "Delete this asset?" })
    .getByRole("button", { name: "Delete asset" })
    .click();
  await expect(page.getByText("Asset deleted.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Disposable.png", exact: true }),
  ).toHaveCount(0);
});

test("saves ordered Gallery images and a cover, previews unsaved changes and protects referenced assets", async ({
  page,
  request,
}) => {
  await signIn(page);
  const assets = await Promise.all(
    ["gallery-a.png", "gallery-b.png"].map(async (filename, index) => {
      const response = await page.request.post("/api/media", {
        headers,
        data: {
          data: png.toString("base64"),
          mime: "image/png",
          filename,
          alt: `Gallery subject ${index + 1}`,
        },
      });
      expect(response.status()).toBe(201);

      return filename;
    }),
  );

  const collection = MediaCollectionSchema.parse(
    await (await page.request.get("/api/media/library?q=gallery-")).json(),
  );
  const first = collection.items.find((item) => item.filename === assets[0]);
  expect(first).toBeDefined();

  if (!first) {
    throw new Error("Missing fixture image");
  }

  const response = await page.request.post("/api/pages", {
    headers,
    data: {
      type: "PAGE",
      layout: "GALLERY",
      status: "PUBLISHED",
      title: "Media browser gallery",
      slug: "media-browser-gallery",
    },
  });
  expect(response.status()).toBe(201);
  const gallery = ContentRecordSchema.parse(await response.json());
  await page.goto(`/admin/pages/${gallery.id}`);
  const group = page.getByRole("group", { name: "Gallery images" });
  await group.getByRole("button", { name: "Choose images" }).click();
  const picker = page.getByRole("dialog", { name: "Choose images" });
  await picker.getByRole("button", { name: assets[0], exact: true }).click();
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(group.getByRole("listitem")).toHaveCount(0);
  await group.getByRole("button", { name: "Choose images" }).click();
  await picker.getByRole("button", { name: assets[0], exact: true }).click();
  await picker.getByRole("button", { name: assets[1], exact: true }).click();
  await picker.getByRole("button", { name: "Use selection" }).click();
  await group
    .getByRole("button", { name: `Move up ${assets[1]}` })
    .press("Enter");
  await expect(group.getByRole("listitem").first()).toContainText(assets[1]);

  await page
    .getByRole("group", { name: "Cover image" })
    .getByRole("button", { name: "Choose image" })
    .click();
  const cover = page.getByRole("dialog", { name: "Choose image" });
  await cover.getByRole("button", { name: assets[0], exact: true }).click();
  await cover.getByRole("button", { name: "Use selection" }).click();

  await page.getByRole("button", { name: "Live Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Public frontend preview"]');
  const privateImage = preview.getByRole("img", { name: "Gallery subject 2" });
  await expect(privateImage).toBeVisible({ timeout: 30_000 });
  await privateImage.scrollIntoViewIfNeeded();
  await expect
    .poll(async () =>
      privateImage.evaluate(
        (canvas: HTMLCanvasElement) =>
          canvas.getContext("2d")?.getImageData(0, 0, 1, 1).data[0],
      ),
    )
    .toBe(255);
  expect((await request.get(`${web}/media/${first.id}`)).status()).toBe(404);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Page updated.", { exact: true })).toBeVisible();
  await page.getByLabel("Unsaved live updates").uncheck();
  await expect(
    preview.getByRole("img", { name: "Gallery subject 2" }),
  ).toBeVisible();
  expect(
    (await page.request.delete(`/api/media/${first.id}`, { headers })).status(),
  ).toBe(409);
  expect((await request.get(`${web}/media/${first.id}`)).status()).toBe(200);

  await page.reload();
  await expect(group.getByRole("listitem").first()).toContainText(assets[1]);

  for (const preset of ["minimal", "modern", "classic"]) {
    const appearance = await page.request.put(
      "/api/admin/settings/appearance",
      {
        headers,
        data: {
          websiteTemplate: "blog",
          stylePreset: preset,
          colorMode: preset === "modern" ? "dark" : "light",
        },
      },
    );
    expect(appearance.status()).toBe(200);
    await page.goto(`${web}/en/pages/${gallery.slug}`);
    await expect(page.locator("html")).toHaveAttribute(
      "data-style-preset",
      preset,
    );
    const images = page.locator("figure img");
    await expect(images).toHaveCount(2);
    await expect(images.first()).toHaveAttribute("alt", "Gallery subject 2");
    await expect(images.last()).toHaveAttribute("alt", "Gallery subject 1");
    await images.first().scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        images
          .first()
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBe(4);
  }
});

test("replaces and removes a post cover independently of a structured image", async ({
  page,
  request,
}) => {
  await signIn(page);

  for (const filename of ["post-original.png", "post-replacement.png"]) {
    const upload = await page.request.post("/api/media", {
      headers,
      data: {
        filename,
        data: png.toString("base64"),
        mime: "image/png",
        alt:
          filename === "post-original.png"
            ? "Red rectangle"
            : "Replacement image",
      },
    });
    expect(upload.status()).toBe(201);
  }

  const created = await page.request.post("/api/post", {
    headers,
    data: {
      type: "POST",
      title: "Media browser post",
      slug: "media-browser-post",
      status: "PUBLISHED",
    },
  });
  expect(created.status()).toBe(201);
  const post = ContentRecordSchema.parse(await created.json());
  await page.goto(`/admin/posts/${post.id}`);
  const cover = page.getByRole("group", { name: "Cover image" });
  const picker = page.getByRole("dialog", { name: "Choose image" });
  const save = page.getByRole("button", { name: "Save changes" });
  await cover.getByRole("button", { name: "Choose image" }).click();
  await picker
    .getByRole("button", { name: "post-original.png", exact: true })
    .click();
  await picker.getByRole("button", { name: "Use selection" }).click();
  await save.click();
  await expect(page.getByText("Post updated.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(cover.getByRole("img", { name: "Red rectangle" })).toBeVisible();

  await cover.getByRole("button", { name: "Choose image" }).click();
  await picker
    .getByRole("button", { name: "post-replacement.png", exact: true })
    .click();
  await picker.getByRole("button", { name: "Use selection" }).click();
  await expect(
    cover.getByRole("img", { name: "Replacement image" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add content image" }).click();
  await picker
    .getByRole("button", { name: "post-original.png", exact: true })
    .click();
  await picker.getByRole("button", { name: "Use selection" }).click();
  await page
    .getByRole("group", { name: "Content images" })
    .getByRole("textbox", { name: "Alternative text" })
    .fill("Context-specific red shape");
  await save.click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(
    cover.getByRole("img", { name: "Replacement image" }),
  ).toBeVisible();
  await cover.getByRole("button", { name: "Remove reference" }).click();
  await save.click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(cover.getByRole("img")).toHaveCount(0);

  const assets = MediaCollectionSchema.parse(
    await (
      await page.request.get("/api/media/library?q=post-replacement.png")
    ).json(),
  );
  expect(assets.items).toHaveLength(1);
  const content = await request.get(`${web}/en/posts/${post.slug}`);
  expect(content.status()).toBe(200);
  await page.goto(`${web}/en/posts/${post.slug}`);
  await expect(
    page.getByRole("img", { name: "Context-specific red shape" }),
  ).toBeVisible();
});
