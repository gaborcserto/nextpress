import { documentMime, MediaAssetSchema } from "@nextpress/shared/media";

import { jsonFetcher } from "@/lib/api";

export async function uploadMediaFile(file: File, documents: boolean) {
  if (documents) {
    const query = new URLSearchParams({ filename: file.name });
    const response = await jsonFetcher<unknown>(`/api/documents?${query}`, {
      method: "POST",
      headers: { "Content-Type": documentMime },
      body: file,
    });

    return MediaAssetSchema.parse(response);
  }

  const input = await file.arrayBuffer();
  const bytes = new Uint8Array(input);
  const chunks: string[] = [];

  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }

  const response = await jsonFetcher<unknown>("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mime: file.type,
      data: btoa(chunks.join("")),
      alt: null,
    }),
  });

  return MediaAssetSchema.parse(response);
}
