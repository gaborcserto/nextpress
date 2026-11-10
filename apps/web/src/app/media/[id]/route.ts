import { publicApiOrigin } from "@/lib/content/public-api.server";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id))
    return new Response(null, { status: 404 });
  try {
    const response = await fetch(
      `${publicApiOrigin()}/api/public/media/${id}`,
      {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!response.ok)
      return new Response(null, {
        status: response.status === 404 ? 404 : 503,
      });

    return new Response(response.body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
