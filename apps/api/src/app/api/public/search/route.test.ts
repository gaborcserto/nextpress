import { beforeEach, expect, it, vi } from "vitest";

const search = vi.hoisted(() => vi.fn());
vi.mock("@/lib/public/search.server", () => ({
  searchPublishedContent: search,
}));

import { GET } from "./route";

beforeEach(() => {
  search.mockReset();
});

it.each([
  "q=x&q=y",
  "q=" + "x".repeat(201),
  "page=0",
  "page=101",
  "sort=bad",
  "secret=true",
])("rejects invalid parameters: %s", async (params) => {
  expect(
    (await GET(new Request(`http://localhost/api/public/search?${params}`)))
      .status,
  ).toBe(400);
  expect(search).not.toHaveBeenCalled();
});

it("returns only the validated public projection without caching", async () => {
  search.mockResolvedValue({ results: [], total: 0, taxonomies: [] });
  const response = await GET(
    new Request("http://localhost/api/public/search?q=react"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("does not expose database failure details", async () => {
  search.mockRejectedValue(new Error("private database detail"));
  const response = await GET(
    new Request("http://localhost/api/public/search?q=react"),
  );
  expect(response.status).toBe(500);
  expect(await response.text()).not.toContain("private database detail");
});
