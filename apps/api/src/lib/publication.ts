import type { Prisma } from "@nextpress/db/generated/prisma/client";

type PublicationState = {
  status: "DRAFT" | "PUBLISHED";
  publishedAt: Date | null;
};

type PublicationChange = {
  status?: PublicationState["status"];
  publishedAt?: string | null;
};

export type EditorialPublicationState =
  | "DRAFT"
  | "PUBLISHED"
  | "SCHEDULED"
  | "MISSING_DATE";

export function editorialPublicationWhere(
  state: EditorialPublicationState,
  now: Date,
): Prisma.PageWhereInput {
  switch (state) {
    case "DRAFT":
      return { status: state };
    case "PUBLISHED":
      return { status: state, publishedAt: { lte: now } };
    case "SCHEDULED":
      return { status: "PUBLISHED", publishedAt: { gt: now } };
    case "MISSING_DATE":
      return { status: "PUBLISHED", publishedAt: null };
  }
}

export function editorialPublicationState(
  status: PublicationState["status"],
  publishedAt: Date | null,
  now = new Date(),
): EditorialPublicationState {
  if (status === "DRAFT") {
    return "DRAFT";
  }

  if (publishedAt === null) {
    return "MISSING_DATE";
  }

  return publishedAt.getTime() > now.getTime() ? "SCHEDULED" : "PUBLISHED";
}

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
