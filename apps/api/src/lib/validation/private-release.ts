import { z } from "zod";

export const PrivateReleaseCursorSchema = z.strictObject({
  scheduledFor: z.iso.datetime(),
  pageId: z.string().min(1).max(200),
});
export const ExecutePrivateReleasesSchema = z.strictObject({
  after: PrivateReleaseCursorSchema.optional(),
});
export const PrivateReleaseExecutionResultSchema = z.strictObject({
  results: z.array(
    z.strictObject({
      pageId: z.string(),
      outcome: z.enum(["executed", "refused"]),
      code: z.string().optional(),
    }),
  ),
  remainingMayExist: z.boolean(),
  nextCursor: PrivateReleaseCursorSchema.nullable(),
});
