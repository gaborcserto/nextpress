import type {
  TagCreateSchema,
  TagUpdateSchema,
} from "@nextpress/shared/api-contracts";
import type { z } from "zod";
export {
  TagCreateSchema,
  TagIdsSchema,
  TagUpdateSchema,
} from "@nextpress/shared/api-contracts";
export type TagCreateInput = z.infer<typeof TagCreateSchema>;
export type TagUpdateInput = z.infer<typeof TagUpdateSchema>;
