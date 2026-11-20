import { isUnavailableResponse } from "@nextpress/shared/service-unavailable";

const errorCopy = {
  404: ["Page not found", "The requested API resource could not be found."],
  500: ["Application error", "The API could not complete this request."],
  503: [
    "Service unavailable",
    "The API is temporarily unavailable. Please try again shortly.",
  ],
};

export function presentBrowserError(
  request: Request,
  response: Response,
): Response {
  if (
    request.method !== "GET" ||
    request.headers.get("sec-fetch-mode") !== "navigate" ||
    !request.headers
      .get("accept")
      ?.split(",")
      .some((range) => range.trim().toLowerCase() === "text/html")
  ) {
    return response;
  }

  const status = isUnavailableResponse(response) ? 503 : response.status;

  if (status !== 404 && status !== 500 && status !== 503) {
    return response;
  }

  const [title, description] = errorCopy[status];
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.append("Vary", "Accept, Sec-Fetch-Mode");

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${status} ${title} | NextPress API</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; }
    main { min-height: 100svh; box-sizing: border-box; display: grid; place-content: center;
      padding: 1.5rem; text-align: center; }
    .brand { font-size: 1.5rem; font-weight: 750; }
    .brand span { color: #c65310; }
    .status { display: block; font-size: clamp(4rem, 18vw, 8rem); line-height: 1; }
    h1 { font-size: clamp(1.5rem, 5vw, 2rem); margin: .75rem 0; }
    p { margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <main>
    <p class="brand">nextpress<span>.</span></p>
    <h1><span class="status">${status}</span> ${title}</h1>
    <p>${description}</p>
  </main>
</body>
</html>`,
    { status, headers },
  );
}
