import { beforeEach, describe, expect, it, vi } from "vitest";

import { actionLimits, limitMutation, RateLimiter, tooManyRequests } from "./rate-limit.server";

beforeEach(() => actionLimits.clear());

describe("bounded process-local limiter", () => {
  it("reserves attempts synchronously and never extends the fixed cooldown", async () => {
    const limiter = new RateLimiter();
    const decisions = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve(limiter.consume("account", 5, 60_000, 1000))));
    expect(decisions.filter((retry) => retry === null)).toHaveLength(5);
    expect(limiter.consume("account", 5, 60_000, 60_001)).toBe(1);
    expect(limiter.consume("account", 5, 60_000, 61_000)).toBeNull();
  });

  it("bounds storage without evicting active accounts, then reclaims expired keys", () => {
    const limiter = new RateLimiter(2);
    expect(limiter.consume("first", 1, 60_000, 0)).toBeNull();
    expect(limiter.consume("second", 1, 120_000, 0)).toBeNull();
    for (let i = 0; i < 100; i++) expect(limiter.consume(`rotated-${i}`, 1, 60_000, 1000)).toBe(59);
    expect(limiter.size).toBe(2);
    expect(limiter.consume("first", 1, 60_000, 1000)).toBe(59);
    expect(limiter.consume("third", 1, 60_000, 60_000)).toBeNull();
    expect(limiter.size).toBe(2);
    limiter.consume("last", 1, 60_000, 120_000);
    expect(limiter.size).toBe(1);
    limiter.clear();
    expect(limiter.size).toBe(0);
  });

  it("resets only the selected identity", () => {
    const limiter = new RateLimiter();
    limiter.consume("first", 1, 60_000, 0);
    limiter.consume("second", 1, 60_000, 0);
    limiter.reset("first");
    expect(limiter.consume("first", 1, 60_000, 0)).toBeNull();
    expect(limiter.consume("second", 1, 60_000, 0)).toBe(60);
  });

  it("returns minimal 429 responses with standard retry and cache headers", async () => {
    const response = tooManyRequests(42);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "Too many requests. Please try again later." });
  });

  it("isolates authenticated users and action scopes", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000);
    try {
      for (let i = 0; i < 30; i++) expect(limitMutation("admin", "users")).toBeNull();
      expect(limitMutation("admin", "users")?.status).toBe(429);
      expect(limitMutation("editor", "users")).toBeNull();
      expect(limitMutation("admin", "content")).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});
