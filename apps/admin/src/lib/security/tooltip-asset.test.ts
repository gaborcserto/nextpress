// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { adminContentSecurityPolicy } from "./headers";

describe("tooltip CSP compatibility", () => {
  it("replaces the dependency's inline mask with a same-origin SVG", () => {
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const svg = readFileSync(new URL("../../../public/tooltip-tail.svg", import.meta.url), "utf8");

    expect(css).toMatch(/\.tooltip::after\s*\{\s*mask-image:\s*url\("\/tooltip-tail\.svg"\);\s*\}/);
    expect(svg).toContain('viewBox="0 0 8 4"');
    expect(svg).toContain("<path ");
    expect(svg).not.toMatch(/data:|<script|href=/);
    for (const production of [false, true]) {
      const policy = adminContentSecurityPolicy("test-nonce", production);
      expect(policy).toContain("img-src 'self'");
      expect(policy).not.toContain("data:");
    }
  });
});
