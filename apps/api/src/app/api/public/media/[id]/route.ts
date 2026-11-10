import { notfound, oops } from "@/lib/api";
import { ContentNotFoundError } from "@/lib/auth/content-access";
import { serveMedia } from "@/lib/services/media.server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    return await serveMedia((await ctx.params).id);
  } catch (error) {
    return error instanceof ContentNotFoundError ? notfound() : oops();
  }
}
