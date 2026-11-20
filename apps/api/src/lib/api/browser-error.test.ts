import { serviceUnavailableHeader } from "@nextpress/shared/service-unavailable";
import { expect, it } from "vitest";

import { presentBrowserError } from "./browser-error";
import { internalError, notfound } from "./http";

const url = "http://localhost/api/public/settings";

it.each([
  {
    scenario: "missing resource",
    response: () => notfound(),
    status: 404,
    title: "Page not found",
  },
  {
    scenario: "unexpected error",
    response: () => internalError(),
    status: 500,
    title: "Application error",
  },
  {
    scenario: "database adapter outage",
    response: () => internalError({ cause: { kind: "DatabaseNotReachable" } }),
    status: 503,
    title: "Service unavailable",
  },
  {
    scenario: "dual-stack database connection refusal",
    response: () =>
      internalError(
        Object.assign(new Error("Database connection failed"), {
          name: "PrismaClientKnownRequestError",
          code: "ECONNREFUSED",
        }),
      ),
    status: 503,
    title: "Service unavailable",
  },
])(
  "renders HTTP $status for browser navigation during a $scenario",
  async ({ response, status, title }) => {
    const request = new Request(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "Sec-Fetch-Mode": "navigate",
      },
    });
    const original = response();
    original.headers.set("X-Content-Type-Options", "nosniff");

    const result = presentBrowserError(request, original);

    expect(result.status).toBe(status);
    expect(result.headers.get("Content-Type")).toContain("text/html");
    expect(result.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(await result.text()).toContain(title);
  },
);

it.each(["application/json", "text/html"])(
  "preserves the JSON outage contract for a consumer accepting %s without document navigation",
  async (accept) => {
    const request = new Request(url, { headers: { Accept: accept } });
    const response = internalError({ errorCode: "P1001" });

    const result = presentBrowserError(request, response);

    expect(result.status).toBe(500);
    expect(result.headers.get(serviceUnavailableHeader)).toBe("1");
    expect(await result.json()).toEqual({ error: "Unexpected error" });
  },
);
