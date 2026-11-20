import type { z } from "zod";

export function parseListFilters<Shape extends z.ZodRawShape>(
  params: URLSearchParams,
  schema: z.ZodObject<Shape>,
) {
  const entries: [string, string][] = [];

  for (const key of Object.keys(schema.shape)) {
    const values = params.getAll(key);

    if (values.length > 1) {
      return null;
    }

    if (values[0] !== undefined) {
      entries.push([key, values[0]]);
    }
  }

  const result = schema.safeParse(Object.fromEntries(entries));

  return result.success ? result.data : null;
}

export function escapeListSearch(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
