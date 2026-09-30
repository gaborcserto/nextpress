import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiRequestError, jsonFetcher, jsonResult } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("admin API client", () => {
  it("returns parsed JSON for successful responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ value: 42 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(jsonFetcher<{ value: number }>("/api/value")).resolves.toEqual({
      value: 42,
    });
  });

  it("uses the API error field and preserves the response status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "You cannot delete this user." }), {
          status: 409,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const [, error] = await jsonResult("/api/admin/users/user-1");

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      message: "You cannot delete this user.",
      status: 409,
    });
  });

  it("reports network failures without attempting JSON parsing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(jsonFetcher("/api/value")).rejects.toThrow("offline");
  });
});
