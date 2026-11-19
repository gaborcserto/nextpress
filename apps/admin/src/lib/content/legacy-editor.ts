import { showToast } from "@/ui/utils";

// A background fetch must not replace the form's concurrency token.
export const legacyEditorRevalidation = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

export function prepareLegacyUpdate<T extends { publishedAt?: string | null }>(
  values: T,
  loaded: T | undefined,
): T {
  const submitted = { ...values };

  if (loaded && values.publishedAt === loaded.publishedAt) {
    delete submitted.publishedAt;
  }

  return submitted;
}

export function reportLegacySaveFailure(status: number, isEdit: boolean): void {
  if (status === 401 || status === 403) {
    showToast("You are not authorized to save this content.", "error");

    return;
  }

  if (status === 409) {
    showToast(
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
