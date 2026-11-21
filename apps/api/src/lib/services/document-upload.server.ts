import "server-only";

import {
  DocumentFilenameSchema,
  documentMime,
  maxDocumentUploadBytes,
} from "@nextpress/shared/media";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";

import {
  contentWriteWhere,
  type ContentActor,
} from "@/lib/auth/content-access";

import {
  MediaBusyError,
  MediaValidationError,
  storeMedia,
} from "./media.server";

const runQpdf = promisify(execFile);
const reportSchema = z.object({
  encrypt: z.object({ encrypted: z.literal(false) }),
  pages: z.array(z.unknown()).min(1).max(500),
  qpdf: z.array(z.record(z.string(), z.unknown())).length(2),
});
const prohibitedNames = new Set([
  "/A",
  "/AA",
  "/AcroForm",
  "/AF",
  "/Annots",
  "/EF",
  "/EmbeddedFile",
  "/EmbeddedFiles",
  "/F",
  "/FFilter",
  "/Filespec",
  "/GoToR",
  "/GoToE",
  "/JavaScript",
  "/JS",
  "/Launch",
  "/OpenAction",
  "/RichMedia",
  "/URI",
  "/XFA",
]);
let uploading = false;

export function acceptsPdfReport(report: unknown) {
  const parsed = reportSchema.safeParse(report);

  if (!parsed.success) {
    return false;
  }

  const pending: unknown[] = [...parsed.data.qpdf];

  while (pending.length) {
    const value = pending.pop();

    if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) {
        if (
          prohibitedNames.has(key) ||
          (typeof child === "string" && prohibitedNames.has(child))
        ) {
          return false;
        }

        pending.push(child);
      }
    }
  }

  return true;
}

async function validatePdf(bytes: Buffer) {
  if (
    !/^%PDF-(?:1\.[0-7]|2\.0)[\r\n]/.test(
      bytes.subarray(0, 12).toString("latin1"),
    ) ||
    !/%%EOF[\t\n\r ]*$/.test(bytes.subarray(-32).toString("latin1"))
  ) {
    throw new MediaValidationError();
  }

  const directory = await mkdtemp(join(tmpdir(), "nextpress-pdf-"));

  try {
    const input = join(directory, "input.pdf");
    await writeFile(input, bytes, { mode: 0o600 });
    const report = await runQpdf(
      "qpdf",
      [
        "--global",
        "--parser-max-nesting=64",
        "--parser-max-container-size=20000",
        "--",
        "--suppress-recovery",
        "--json=2",
        "--json-stream-data=none",
        "--json-key=qpdf",
        "--json-key=encrypt",
        "--json-key=pages",
        input,
      ],
      { timeout: 5000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
    );

    const parsed: unknown = JSON.parse(report.stdout);

    if (!acceptsPdfReport(parsed)) {
      throw new MediaValidationError();
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (typeof error.code === "number" ||
        error.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ||
        ("killed" in error && error.killed === true))
    ) {
      throw new MediaValidationError();
    }

    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function readUpload(request: Request) {
  const uploadLimit = z.coerce
    .number()
    .int()
    .min(1)
    .max(maxDocumentUploadBytes)
    .parse(process.env.DOCUMENT_UPLOAD_MAX_BYTES ?? maxDocumentUploadBytes);
  const reader = request.body?.getReader();
  const deadline = AbortSignal.timeout(15_000);

  if (!reader) {
    throw new MediaValidationError();
  }

  const cancel = () => void reader.cancel().catch(() => undefined);
  deadline.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      size += value.byteLength;

      if (size > uploadLimit) {
        throw new MediaValidationError();
      }

      chunks.push(value);
    }

    if (deadline.aborted) {
      throw new MediaValidationError();
    }

    return Buffer.concat(chunks, size);
  } finally {
    deadline.removeEventListener("abort", cancel);
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

export async function uploadDocument(request: Request, actor: ContentActor) {
  contentWriteWhere(actor);
  const query = new URL(request.url).searchParams;
  const filename = DocumentFilenameSchema.safeParse(query.get("filename"));

  if (
    !filename.success ||
    query.size !== 1 ||
    request.headers.get("content-type") !== documentMime
  ) {
    throw new MediaValidationError();
  }

  if (uploading) {
    throw new MediaBusyError();
  }

  uploading = true;

  try {
    const bytes = await readUpload(request);
    await validatePdf(bytes);

    return await storeMedia(bytes, "pdf", documentMime, actor, {
      filename: filename.data,
      caption: filename.data.slice(0, -4),
    });
  } finally {
    uploading = false;
  }
}
