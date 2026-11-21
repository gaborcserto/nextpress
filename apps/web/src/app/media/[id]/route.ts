import { MediaInputMimeSchema } from "@nextpress/shared/media";
import {
  renderRequestId,
  requestIdHeader,
  responseRequestId,
  setUpstreamRequestId,
} from "@nextpress/shared/request-correlation";
import { writeServerLog } from "@nextpress/shared/server-logging";

import { publicApiOrigin } from "@/lib/content/public-api.server";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) {
    return new Response(null, { status: 404 });
  }

  const requestId = renderRequestId(request.headers);
  const headers = new Headers();
  setUpstreamRequestId(headers, requestId);

  try {
    const response = await fetch(
      `${publicApiOrigin()}/api/public/media/${id}`,
      {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        headers,
        signal: AbortSignal.timeout(10_000),
      },
    );

    const correlatedId = responseRequestId(response.headers, requestId);

    if (!response.ok) {
      if (response.status !== 404) {
        writeServerLog("web", "public.upstream.failed", {
          requestId,
          upstreamRequestId: correlatedId,
          operation: "public.media",
          code: "upstream",
          status: response.status,
        });
      }

      return new Response(null, {
        status: response.status === 404 ? 404 : 503,
        headers: { [requestIdHeader]: requestId },
      });
    }

    const mime = MediaInputMimeSchema.safeParse(
      response.headers.get("Content-Type"),
    );

    if (!mime.success) {
      await response.body?.cancel();

      return new Response(null, {
        status: 503,
        headers: { [requestIdHeader]: requestId },
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": mime.data,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        [requestIdHeader]: requestId,
      },
    });
  } catch {
    writeServerLog("web", "public.upstream.failed", {
      requestId,
      operation: "public.media",
      code: "transport",
      status: 503,
    });

    return new Response(null, {
      status: 503,
      headers: { [requestIdHeader]: requestId },
    });
  }
}
