import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => vi.unstubAllEnvs());

describe("Swagger UI asset access", () => {
  it.each(["production", "test"])("hides Swagger assets in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    const response = await GET(new Request("http://localhost/api-docs/swagger-ui.css"), {
      params: Promise.resolve({ asset: "swagger-ui.css" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });

  it("serves the pinned local bundle and stylesheet in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const bundle = await GET(new Request("http://localhost/api-docs/swagger-ui-bundle.js"), {
      params: Promise.resolve({ asset: "swagger-ui-bundle.js" }),
    });
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await bundle.text()).toContain("SwaggerUIBundle");

    const stylesheet = await GET(new Request("http://localhost/api-docs/swagger-ui.css"), {
      params: Promise.resolve({ asset: "swagger-ui.css" }),
    });
    expect(stylesheet.status).toBe(200);
    expect(stylesheet.headers.get("content-type")).toBe("text/css; charset=utf-8");
    expect(await stylesheet.text()).toContain(".swagger-ui");
  });

  it("rejects asset names outside the local allowlist", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await GET(new Request("http://localhost/api-docs/package.json"), {
      params: Promise.resolve({ asset: "package.json" }),
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });
});
