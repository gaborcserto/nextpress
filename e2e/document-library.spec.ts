import { ContentRecordSchema } from "@nextpress/shared/api-contracts";
import { MediaAssetSchema } from "@nextpress/shared/media";
import { expect, test } from "@playwright/test";

const web = "http://localhost:49200";
const origin = "http://localhost:49201";
const headers = { origin, "content-type": "application/json" };

function samplePdf(catalog = "") {
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${catalog} >>`,
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << >> >>",
  ];
  let pdf = "%PDF-1.7\n";
  const offsets: number[] = [];

  for (const [index, object] of objects.entries()) {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }

  const xref = pdf.length;
  const entries = offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");

  return Buffer.from(
    `${pdf}xref\n0 4\n0000000000 65535 f \n${entries}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
  );
}

test("document uploads authorize attachments and revoke them after unpublishing", async ({
  browser,
  page,
  request,
}) => {
  await page.goto("/auth/sign-in");
  await page.getByLabel("Email", { exact: true }).fill("admin@example.invalid");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Disposable browser passphrase 2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  await page.getByRole("link", { name: "Document Library" }).first().click();

  const collection = await request.get(`${origin}/api/documents`);
  expect(collection.status()).toBe(401);
  const uploaded = page.waitForResponse(
    (response) =>
      response.url().includes("/api/documents?filename=") &&
      response.status() === 201,
  );

  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.getByRole("heading", { name: "Document Library" }),
    ).toBeVisible();
    expect(
      await page.locator("body").evaluate((body) => body.scrollWidth),
    ).toBeLessThanOrEqual(width);
  }

  await page.getByLabel("Upload PDFs").setInputFiles([
    { name: "Árvíztűrő.pdf", mimeType: "application/pdf", buffer: samplePdf() },
    {
      name: "malformed.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7\n%%EOF\n"),
    },
    {
      name: "interactive.pdf",
      mimeType: "application/pdf",
      buffer: samplePdf("/OpenAction [3 0 R /Fit]"),
    },
  ]);
  const asset = MediaAssetSchema.parse(await (await uploaded).json());

  await expect(page.getByText("Uploaded", { exact: true })).toHaveCount(1);
  await expect(
    page.getByText("Upload failed. Check the file or try again."),
  ).toHaveCount(2);
  await page.getByRole("button", { name: /Árvíztűrő/ }).click();
  await page.getByLabel("Display title").fill("Annual report");
  await page.getByRole("button", { name: "Save metadata" }).click();
  await expect(page.getByText("Metadata saved.")).toBeVisible();

  const path = `/media/${asset.id}`;
  const attachment = await page.request.get(`/api${path}`);
  expect(attachment.headers()["content-type"]).toBe("application/pdf");
  expect(attachment.headers()["content-disposition"]).toContain(
    "%C3%81rv%C3%ADzt%C5%B1r%C5%91.pdf",
  );
  expect(attachment.headers()["cache-control"]).toBe("private, no-store");
  expect(await attachment.body()).toEqual(samplePdf());
  expect((await request.get(`${web}${path}`)).status()).toBe(404);

  const created = await page.request.post("/api/pages", {
    headers,
    data: {
      type: "PAGE",
      layout: "STANDARD",
      status: "DRAFT",
      slug: "annual-report-pdf",
      title: "Annual report page",
    },
  });
  expect(created.status()).toBe(201);
  const article = ContentRecordSchema.parse(await created.json());

  await page.goto(`/admin/pages/${article.id}`);
  const addPdf = page.getByRole("button", { name: "Add PDF document" });
  const picker = page.getByRole("dialog", { name: "Choose PDF" });
  const report = picker.getByRole("button", { name: /Annual report/ });
  await addPdf.click();
  await report.press("Enter");
  await picker.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByLabel("Display title")).toHaveCount(0);

  await addPdf.click();
  await report.click();
  await picker.getByRole("button", { name: "Use selection" }).click();
  await page.getByLabel("Display title").fill("Annual report download");
  await page
    .getByRole("group", { name: "Content assets" })
    .getByLabel("Description")
    .fill("Financial year");
  await page.getByRole("button", { name: "Live Preview", exact: true }).click();
  const preview = page.frameLocator('iframe[title="Public frontend preview"]');
  const download = preview.getByRole("link", {
    name: "Annual report download (PDF)",
  });
  await expect(download).toHaveAttribute("href", `${origin}/api${path}`);

  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.getByLabel("Unsaved live updates").uncheck();
  await expect(download).toBeVisible();

  expect((await request.get(`${web}${path}`)).status()).toBe(404);
  const publish = await page.request.put(`/api/pages/${article.id}`, {
    headers,
    data: { status: "PUBLISHED", expectedVersion: article.workingVersion + 1 },
  });
  expect(publish.status()).toBe(200);
  const publishedPage = ContentRecordSchema.parse(await publish.json());

  await page.goto(`${web}/en/pages/${article.slug}`);
  await expect(
    page.getByRole("link", { name: "Annual report download (PDF)" }),
  ).toHaveAttribute("href", path);
  const published = await request.get(`${web}${path}`);

  expect(published.status()).toBe(200);
  expect(published.headers()["content-disposition"]).toContain("attachment;");
  expect(
    (await page.request.delete(`${origin}/api${path}`, { headers })).status(),
  ).toBe(409);
  expect(
    (
      await page.request.put(`${origin}/api/pages/${article.id}`, {
        headers,
        data: {
          status: "DRAFT",
          expectedVersion: publishedPage.workingVersion,
        },
      })
    ).status(),
  ).toBe(200);
  expect((await request.get(`${web}${path}`)).status()).toBe(404);
  const draftPost = await page.request.post(`${origin}/api/post`, {
    headers,
    data: {
      title: "PDF draft post",
      slug: "pdf-draft-post",
      type: "POST",
      status: "DRAFT",
    },
  });
  expect(draftPost.status()).toBe(201);
  const post = ContentRecordSchema.parse(await draftPost.json());

  await page.goto(`${origin}/admin/posts/${post.id}`);
  await addPdf.click();
  await report.click();
  await picker.getByRole("button", { name: "Use selection" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved$/ }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display title")).toHaveValue("Annual report");
  expect((await request.get(`${web}${path}`)).status()).toBe(404);

  const hu = await browser.newContext({
    locale: "hu-HU",
    colorScheme: "dark",
    viewport: { width: 390, height: 900 },
    storageState: await page.context().storageState(),
  });

  try {
    const library = await hu.newPage();
    await library.goto(`${origin}/admin/documents`);
    await expect(
      library.getByRole("heading", { name: "Dokumentumtár" }),
    ).toBeVisible();
    await expect(library.getByLabel("PDF-fájlok feltöltése")).toBeVisible();
  } finally {
    await hu.close();
  }
});
