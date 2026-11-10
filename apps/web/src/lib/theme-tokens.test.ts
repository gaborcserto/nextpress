// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/skins/default.css", import.meta.url),
  "utf8",
);
const palettes = [...css.matchAll(/:root[^{}]+\{([^}]+)\}/g)].map(
  (match) => match[1] ?? "",
);

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return (
    (channels[0] ?? 0) * 0.2126 +
    (channels[1] ?? 0) * 0.7152 +
    (channels[2] ?? 0) * 0.0722
  );
}

function color(palette: string, token: string) {
  const value = palette.match(
    new RegExp(`--color-${token}: (#[a-f0-9]{6});`),
  )?.[1];

  if (!value) throw new Error(`Missing compiled token ${token}`);

  return value;
}

describe("compiled default theme tokens", () => {
  it("provides light, dark and system-dark palettes", () => {
    expect(palettes).toHaveLength(3);
    expect(css).toContain("(prefers-color-scheme: dark)");
    expect(css).toContain('[data-color-mode="system"]');
  });
  it.each([0, 1, 2])(
    "keeps essential text contrast at least 4.5:1 in palette %i",
    (index) => {
      const palette = palettes[index] ?? "";

      for (const [foreground, background] of [
        ["text", "page"],
        ["text-muted", "page"],
        ["link", "page"],
        ["text-on-action", "action"],
      ]) {
        const first = luminance(color(palette, foreground ?? ""));
        const second = luminance(color(palette, background ?? ""));
        expect(
          (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
        ).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
