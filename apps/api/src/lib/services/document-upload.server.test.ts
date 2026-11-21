import { DocumentFilenameSchema } from "@nextpress/shared/media";
import { describe, expect, it, vi } from "vitest";

import { acceptsPdfReport } from "./document-upload.server";

vi.mock("@nextpress/db/src/client", () => ({ prisma: {} }));

const report = {
  encrypt: { encrypted: false },
  pages: [{}],
  qpdf: [{}, { "obj:1 0 R": { value: { "/Type": "/Catalog" } } }],
};

describe("PDF admission policy", () => {
  it("accepts a structural report without interactive features", () => {
    expect(acceptsPdfReport(report)).toBe(true);
  });

  it.each([
    ["JavaScript", { "/S": "/JavaScript" }],
    ["launch actions", { "/S": "/Launch" }],
    ["external stream data", { "/F": "u:external.pdf" }],
    ["embedded files", { "/Type": "/EmbeddedFile" }],
    ["interactive forms", { "/AcroForm": "9 0 R" }],
    ["annotations", { "/Annots": ["9 0 R"] }],
    ["automatic actions", { "/OpenAction": "9 0 R" }],
  ])("rejects %s in parsed PDF objects", (_name, value) => {
    expect(
      acceptsPdfReport({ ...report, qpdf: [{}, { "obj:9 0 R": { value } }] }),
    ).toBe(false);
  });

  it("rejects encrypted PDFs", () => {
    expect(acceptsPdfReport({ ...report, encrypt: { encrypted: true } })).toBe(
      false,
    );
  });

  it("rejects page counts above the inspection budget", () => {
    expect(
      acceptsPdfReport({
        ...report,
        pages: Array.from({ length: 501 }, () => ({})),
      }),
    ).toBe(false);
  });

  it.each([
    "../escape.pdf",
    "folder\\escape.pdf",
    "header\r\ninjection.pdf",
    "index.html",
  ])("rejects unsafe or unsupported filenames (%s)", (name) => {
    expect(DocumentFilenameSchema.safeParse(name).success).toBe(false);
  });

  it("preserves Hungarian filenames", () => {
    expect(DocumentFilenameSchema.parse("Árvíztűrő tükörfúrógép.pdf")).toBe(
      "Árvíztűrő tükörfúrógép.pdf",
    );
  });
});
