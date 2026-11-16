type PublicationState = {
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
};

type PublicationChange = {
  status?: PublicationState["status"];
  publishedAt?: string | null;
};

/** Omission preserves history/schedules; explicit null requests immediate publication. */
export function resolvePublicationDate(
  current: PublicationState | null,
  change: PublicationChange,
  now = new Date(),
): Date | null {
  if (change.publishedAt) {
    return new Date(change.publishedAt);
  }

  const status = change.status ?? current?.status ?? "DRAFT";

  if (change.publishedAt === null) {
    return status === "PUBLISHED" ? now : null;
  }

  if (current?.publishedAt) {
    return current.publishedAt;
  }

  // Do not reinterpret undated historical records on an unrelated partial save.
  return change.status === "PUBLISHED" ? now : null;
}
