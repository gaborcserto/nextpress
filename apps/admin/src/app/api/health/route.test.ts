import { expect, it, vi } from "vitest";

import { GET } from "./route";

vi.mock("@nextpress/db/src/client", () => { throw new Error("Health must not load the database"); });
vi.mock("@/lib/auth/auth-server", () => { throw new Error("Health must not load authentication"); });

it("returns only application liveness without authentication or database dependencies", async () => {
  const response = GET();
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ status: "ok" });
});
