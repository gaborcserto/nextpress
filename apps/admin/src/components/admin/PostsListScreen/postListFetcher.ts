import { ContentListSchema } from "@nextpress/shared/api-contracts";
import { z } from "zod";

import { jsonFetcher } from "@/lib/api";

const postListResponseSchema = ContentListSchema.extend({
  items: z.array(ContentListSchema.shape.items.element.passthrough()),
}).passthrough();

export class PostListResponseError extends Error {
  constructor() {
    super("Invalid post list response. Please try again.");
    this.name = "PostListResponseError";
  }
}

export async function fetchPostList(url: string) {
  const body = await jsonFetcher<unknown>(url);
  const result = postListResponseSchema.safeParse(body);

  if (!result.success) {
    throw new PostListResponseError();
  }

  return result.data;
}
