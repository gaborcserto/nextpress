import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";
import { openApiDocument } from "@/lib/api/openapi";

afterEach(() => vi.unstubAllEnvs());

describe("OpenAPI visibility", () => {
  it("serves the formatted contract in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(await response.json()).toEqual(openApiDocument);
  });

  it.each(["production", "test"])("returns an empty uncached 404 in %s", async (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    const response = GET();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });
});
