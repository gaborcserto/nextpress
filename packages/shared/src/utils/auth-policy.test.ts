import { describe, expect, it } from "vitest";

import { emailSchema, passwordSchema } from "./auth-policy";

describe("shared credential policy", () => {
  it("normalizes email without removing plus addressing", () => {
    expect(emailSchema.parse(" User+tag@Example.com ")).toBe("user+tag@example.com");
    expect(emailSchema.safeParse("bad-address").success).toBe(false);
    expect(emailSchema.safeParse("user @example.com").success).toBe(false);
  });

  it("enforces length rather than composition, preserves whitespace, and bounds Unicode input", () => {
    expect(passwordSchema.safeParse("a".repeat(14)).success).toBe(false);
    expect(passwordSchema.parse("a".repeat(15))).toBe("a".repeat(15));
    expect(passwordSchema.parse("a".repeat(128))).toHaveLength(128);
    expect(passwordSchema.safeParse("a".repeat(129)).success).toBe(false);
    expect(passwordSchema.safeParse("😀".repeat(8)).success).toBe(false);
    expect(passwordSchema.safeParse("😀".repeat(15)).success).toBe(true);
    expect(passwordSchema.safeParse("😀".repeat(65)).success).toBe(false);
    expect(passwordSchema.safeParse("\uD800".repeat(15)).success).toBe(false);
    expect(passwordSchema.parse("  a long passphrase  ")).toBe("  a long passphrase  ");
  });
});
