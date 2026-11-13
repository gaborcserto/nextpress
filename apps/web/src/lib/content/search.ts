import { PublicSearchQuerySchema } from "@nextpress/shared/api-contracts";

export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
) {
  const values = Object.fromEntries(
    Object.entries(PublicSearchQuerySchema.shape).map(([key, schema]) => {
      const value = params[key];
      const parsed = schema.safeParse(
        typeof value === "string" ? value : undefined,
      );

      return [key, parsed.success ? parsed.data : schema.parse(undefined)];
    }),
  );

  const query = PublicSearchQuerySchema.parse(values);

  if (query.type === "pages") {
    query.category = undefined;
    query.tag = undefined;
  }

  return query;
}

export function searchHref(
  query: ReturnType<typeof parseSearchParams>,
  page = query.page,
) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries({ ...query, page })) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  return `/search?${params}`;
}
