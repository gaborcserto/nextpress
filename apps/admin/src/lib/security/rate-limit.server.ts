import "server-only";

import { createHash } from "node:crypto";

type Entry = { count: number; expiresAt: number };

/** Fixed windows: rejected requests never extend a cooldown or evict active keys. */
export class RateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxEntries = 4096) {}

  consume(key: string, max: number, windowMs: number, now = Date.now()): number | null {
    // Keys contain identities, so retain only a fixed-size digest in memory.
    const digest = createHash("sha256").update(key).digest("hex");
    for (const [storedKey, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(storedKey);
    }
    const existing = this.entries.get(digest);
    if (existing) {
      if (existing.count >= max) return Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      existing.count++;
      return null;
    }
    if (this.entries.size >= this.maxEntries) {
      // Fail closed for new identities. Key rotation must not erase a cooldown.
      const firstExpiry = Math.min(...Array.from(this.entries.values(), (entry) => entry.expiresAt));
      return Math.max(1, Math.ceil((firstExpiry - now) / 1000));
    }
    this.entries.set(digest, { count: 1, expiresAt: now + windowMs });
    return null;
  }

  reset(key: string) {
    this.entries.delete(createHash("sha256").update(key).digest("hex"));
  }

  clear() {
    this.entries.clear();
  }

  get size() {
    return this.entries.size;
  }
}

// Module lifetime, independent of the per-request Better Auth instance.
// Separate processes, isolates and server bundles may have independent state.
export const accountAttempts = new RateLimiter();
export const actionLimits = new RateLimiter();
export const authBudgets = new RateLimiter(16);

let nextLogAt = 0;
export function logAbuseThrottle() {
  const now = Date.now();
  if (now < nextLogAt) return;
  nextLogAt = now + 60_000;
  console.warn("Application abuse limit reached");
}

export function tooManyRequests(retryAfter: number): Response {
  logAbuseThrottle();
  return Response.json({ error: "Too many requests. Please try again later." }, {
    status: 429,
    headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" },
  });
}

export type MutationLimit = "content" | "create-content" | "taxonomy" | "users" | "settings";

export function limitMutation(userId: string, scope: MutationLimit): Response | null {
  const max = scope === "create-content" || scope === "users" ? 30 : scope === "settings" ? 20 : 120;
  const windowMs = scope === "create-content" || scope === "users" ? 600_000 : 60_000;
  const retry = actionLimits.consume(`${scope}:${userId}`, max, windowMs);
  return retry === null ? null : tooManyRequests(retry);
}
