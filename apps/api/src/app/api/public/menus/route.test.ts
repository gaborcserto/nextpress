import { beforeEach, expect, it, vi } from "vitest";

const getPublicMenus = vi.hoisted(() => vi.fn());

vi.mock("@/lib/public/menus.server", () => ({ getPublicMenus }));

import { GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  getPublicMenus.mockResolvedValue({ header: [], footer: [], sidebar: [] });
});

it("serves each menu projection without caching after a save", async () => {
  const request = new Request("http://localhost/api/public/menus");
  const firstResponse = await GET(request);
  getPublicMenus.mockResolvedValueOnce({
    header: [
      { parent: null, href: "/updated", label: "Updated", newTab: false },
    ],
    footer: [],
    sidebar: [],
  });
  const nextResponse = await GET(request);

  expect(firstResponse.headers.get("cache-control")).toBe("no-store");
  expect(nextResponse.headers.get("cache-control")).toBe("no-store");
  expect(await nextResponse.json()).toMatchObject({
    header: [{ href: "/updated", label: "Updated" }],
  });
  expect(getPublicMenus).toHaveBeenCalledTimes(2);
});
