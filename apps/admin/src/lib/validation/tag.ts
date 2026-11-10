import type { TagCreateSchema } from "@nextpress/shared/api-contracts";
import type { z } from "zod";
export { TagCreateSchema, TagIdsSchema } from "@nextpress/shared/api-contracts";
export type TagCreateInput = z.infer<typeof TagCreateSchema>;
