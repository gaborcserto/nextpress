import "server-only";

import {
  newRequestId,
  requestIdHeader,
  requestSignatureHeader,
  responseRequestId,
  setUpstreamRequestId,
} from "@nextpress/shared/request-correlation";
import {
  writeServerLog,
  type FailureCode,
} from "@nextpress/shared/server-logging";

export function apiOrigin(): string {
  const value = process.env.API_INTERNAL_ORIGIN;

  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("API_INTERNAL_ORIGIN is required");
  }

  const url = new URL(value ?? "http://localhost:49102");

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("API_INTERNAL_ORIGIN must be a fixed HTTP origin");
  }

  return url.origin;
}

export async function forwardApiRequest(request: Request): Promise<Response> {
  const incoming = new URL(request.url);

  if (
    !incoming.pathname.startsWith("/api/") &&
    !incoming.pathname.startsWith("/api-docs/")
  ) {
    return Response.json({ error: "Not Found" }, { status: 404 });
  }

  const requestId = newRequestId();
  const headers = new Headers();
  setUpstreamRequestId(headers, requestId);

  // Never forward client identity, Host, or proxy trust headers.
  for (const name of [
    "cookie",
    "origin",
    "referer",
    "content-type",
    "accept",
    "authorization",
  ]) {
    const value = request.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  const deadline = AbortSignal.timeout(
    incoming.pathname === "/api/private-drafts/execute" &&
      request.method === "POST"
      ? 65000
      : 30000,
  );
  const signal = AbortSignal.any([request.signal, deadline]);
  let failureCode: FailureCode = "configuration";

  try {
    const target = new URL(apiOrigin());
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    failureCode = "transport";

    const hasBody = !["GET", "HEAD"].includes(request.method);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      cache: "no-store",
      redirect: "manual",
      signal,
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("set-cookie");

    for (const cookie of upstream.headers.getSetCookie()) {
      responseHeaders.append("set-cookie", cookie);
    }

    // Fetch decodes compressed bodies; these upstream metadata are no longer valid.
    for (const name of [
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection",
      requestSignatureHeader,
    ]) {
      responseHeaders.delete(name);
    }

    const correlatedId = responseRequestId(responseHeaders, requestId);
    responseHeaders.set(requestIdHeader, correlatedId);
    responseHeaders.set("Cache-Control", "private, no-store");

    if (upstream.status >= 500) {
      writeServerLog("admin", "admin.upstream.failed", {
        requestId,
        upstreamRequestId: correlatedId,
        operation: "forward",
        code: "upstream",
        status: upstream.status,
      });
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const fetchAborted =
      failureCode === "transport" && signal.aborted && error === signal.reason;
    const callerCancelled =
      fetchAborted &&
      request.signal.aborted &&
      signal.reason === request.signal.reason;

    if (!callerCancelled) {
      writeServerLog("admin", "admin.upstream.failed", {
        requestId,
        operation: "forward",
        code:
          fetchAborted && signal.reason === deadline.reason
            ? "timeout"
            : failureCode,
        status: 502,
      });
    }

    return Response.json(
      { error: "API unavailable" },
      {
        status: 502,
        headers: {
          "Cache-Control": "private, no-store",
          [requestIdHeader]: requestId,
        },
      },
    );
  }
}
