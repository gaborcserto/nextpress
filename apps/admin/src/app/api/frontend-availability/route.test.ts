import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("frontend availability", () => {
  it("reports an unconfigured frontend without exposing configuration", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "");
    const fetch = vi.spyOn(globalThis, "fetch");

    const response = await GET();

    expect(await response.json()).toEqual({ available: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports a reachable frontend without returning its URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "https://frontend.example.test");
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const response = await GET();

    expect(await response.json()).toEqual({ available: true });
    expect(fetch).toHaveBeenCalledWith(
      "https://frontend.example.test",
      expect.objectContaining({ method: "HEAD", cache: "no-store" }),
    );
  });

  it("reports a stopped or unreachable frontend as unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_ORIGIN", "https://frontend.example.test");
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"));

    const response = await GET();

    expect(await response.json()).toEqual({ available: false });
  });
});
