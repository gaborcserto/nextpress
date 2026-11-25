import { z } from "zod";

import { databaseDiagnostics } from "@/lib/database-diagnostics";

const homepageConflict = z.object({
  code: z.literal("P2002"),
  meta: z.object({
    driverAdapterError: z.object({
      cause: z.object({
        constraint: z.object({
          index: z.literal("Page_homepage_singleton_key"),
        }),
      }),
    }),
  }),
});

/** Only allowlisted codes become client-facing domain failures. */
export function workingPersistenceFailure(error: unknown): string | null {
  if (homepageConflict.safeParse(error).success) {
    return "HOMEPAGE_CONFLICT";
  }

  for (const value of databaseDiagnostics(error)) {
    if (["55P03", "40001", "40P01", "P2034"].includes(value)) {
      return "TRANSACTION_RETRY_REQUIRED";
    }

    if (["23503", "P2003", "P5505"].includes(value)) {
      return "REFERENCE_CONFLICT";
    }

    if (["23505", "P2002"].includes(value)) {
      return "CONTENT_CONFLICT";
    }

    if (["P5501", "P5502", "P5503", "P5504"].includes(value)) {
      return "WRITER_FENCE_CONFLICT";
    }
  }

  return null;
}
