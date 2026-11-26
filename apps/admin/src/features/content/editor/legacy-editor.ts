import {
  ApiErrorSchema,
  ContentRecordSchema,
} from "@nextpress/shared/api-contracts";

import { showToast } from "@/ui/utils";

import type { EditorImage } from "@nextpress/shared/media";
import type { PageDocument } from "@nextpress/shared/page-document";

import type { PublicationFields } from "../publication/publication-status";

// A background fetch must not replace the form's concurrency token.
export const legacyEditorRevalidation = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

const publicationAcknowledgementSchema = ContentRecordSchema.pick({
  status: true,
  publishedAt: true,
  workingVersion: true,
});

export type PublicationAcknowledgement = ReturnType<
  typeof publicationAcknowledgementSchema.parse
>;
export type LegacySaveOutcome =
  | boolean
  | Omit<PublicationAcknowledgement, "workingVersion">;
type MediaFields = {
  cover?: EditorImage | null;
  gallery?: EditorImage[];
  pageDocument?: PageDocument | null;
};

export type LegacyUpdate<T> = Omit<
  T,
  keyof PublicationFields | keyof MediaFields
> &
  Partial<PublicationFields> &
  MediaFields;

export function prepareLegacyUpdate<T extends PublicationFields & MediaFields>(
  { status, publishedAt, cover, gallery, pageDocument, ...content }: T,
  loaded: PublicationFields & MediaFields,
): LegacyUpdate<T> {
  return {
    ...content,
    ...(cover?.id !== loaded.cover?.id ? { cover } : {}),
    ...(JSON.stringify(gallery?.map(({ id }) => id)) !==
    JSON.stringify(loaded.gallery?.map(({ id }) => id))
      ? { gallery }
      : {}),
    ...(JSON.stringify(pageDocument) !== JSON.stringify(loaded.pageDocument)
      ? { pageDocument }
      : {}),
    ...(status !== loaded.status ? { status } : {}),
    ...((publishedAt ?? null) !== (loaded.publishedAt ?? null)
      ? { publishedAt }
      : {}),
  };
}

export async function readLegacyUpdateResponse(response: Response) {
  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      message: await readContentConflict(response),
    };
  }

  const acknowledgement = publicationAcknowledgementSchema.parse(
    await response.json(),
  );

  return { ok: true as const, acknowledgement };
}

export async function readContentConflict(response: Response) {
  if (response.status !== 409) {
    return undefined;
  }

  const parsed = ApiErrorSchema.safeParse(
    await response.json().catch(() => null),
  );

  return parsed.success ? parsed.data.error : undefined;
}

export function reportLegacySaveFailure(
  status: number,
  isEdit: boolean,
  message?: string,
): void {
  if (status === 401 || status === 403) {
    showToast("You are not authorized to save this content.", "error");

    return;
  }

  if (status === 409) {
    showToast(
      message ??
        "Content changed elsewhere. Your edits are preserved; reload before retrying.",
      "warning",
    );

    return;
  }

  if (status === 400 || status === 422) {
    showToast(
      "Please correct the content errors and try saving again.",
      "warning",
    );

    return;
  }

  showToast(
    `${isEdit ? "Update failed" : "Create failed"}: ${status}`,
    "error",
  );
}
