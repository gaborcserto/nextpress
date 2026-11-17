import { z } from "zod";

export const ExecutePrivateReleasesSchema = z.strictObject({});
export const PrivateReleaseExecutionResultSchema = z.strictObject({
  results: z.array(
    z.strictObject({
      pageId: z.string(),
      outcome: z.enum(["executed", "refused"]),
      code: z.string().optional(),
    }),
  ),
  remainingMayExist: z.boolean(),
});
