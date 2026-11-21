import {
  maxStoredMediaBytes,
  MediaInputMimeSchema,
} from "@nextpress/shared/media";
import {
  pageMediaIds,
  readPageDocument,
} from "@nextpress/shared/page-document";

import type { LivePreviewSnapshot } from "@nextpress/shared/revisions";

export function previewMediaIds(snapshot: LivePreviewSnapshot) {
  const ids = new Set(snapshot.gallery?.map(({ id }) => id));

  if (snapshot.cover) {
    ids.add(snapshot.cover.id);
  }

  const document = snapshot.pageDocument
    ? readPageDocument(snapshot.pageDocument)
    : null;

  if (document?.supported) {
    for (const id of pageMediaIds(document.document)) {
      ids.add(id);
    }
  }

  return ids;
}

export async function loadPreviewMedia(id: string, signal: AbortSignal) {
  try {
    const response = await fetch(`/api/media/${id}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      redirect: "error",
      cache: "no-store",
    });

    if (
      !response.ok ||
      !MediaInputMimeSchema.safeParse(response.headers.get("Content-Type"))
        .success
    ) {
      return null;
    }

    const bytes = await response.arrayBuffer();

    return bytes.byteLength <= maxStoredMediaBytes ? bytes : null;
  } catch {
    return null;
  }
}
