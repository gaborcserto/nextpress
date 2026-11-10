import "server-only";

export function apiOrigin(): string {
  const value = process.env.API_INTERNAL_ORIGIN;
  if (!value && process.env.NODE_ENV === "production")
    throw new Error("API_INTERNAL_ORIGIN is required");
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
  const target = new URL(apiOrigin());
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
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
    if (value !== null) headers.set(name, value);
  }
  try {
    const hasBody = !["GET", "HEAD"].includes(request.method);
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? request.body : undefined,
      ...(hasBody ? { duplex: "half" } : {}),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30000)]),
    });
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("set-cookie");
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append("set-cookie", cookie);
    // Fetch decodes compressed bodies; these upstream metadata are no longer valid.
    for (const name of [
      "content-encoding",
      "content-length",
      "transfer-encoding",
      "connection",
    ])
      responseHeaders.delete(name);
    responseHeaders.set("Cache-Control", "private, no-store");
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      { error: "API unavailable" },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
