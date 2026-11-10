import { PageSchema, PageUpdateSchema } from "@nextpress/shared/api-contracts";
export { PageSchema, PageUpdateSchema };
export type {
  PageCreateInput,
  PageUpdateInput,
} from "@nextpress/shared/api-contracts";

const MAX_PAGE = 10_000;
const MAX_PAGE_SIZE = 100;

export function parsePagination(searchParams: URLSearchParams) {
  if (
    searchParams.getAll("page").length > 1 ||
    searchParams.getAll("limit").length > 1
  )
    return null;
  const pageValue = searchParams.get("page");
  const limitValue = searchParams.get("limit");
  if (
    (pageValue !== null && !/^\d+$/.test(pageValue)) ||
    (limitValue !== null && !/^\d+$/.test(limitValue))
  )
    return null;
  const page = pageValue === null ? 1 : Number(pageValue);
  const limit = limitValue === null ? 50 : Number(limitValue);

  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    page > MAX_PAGE ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > MAX_PAGE_SIZE
  )
    return null;

  return { page, limit };
}
