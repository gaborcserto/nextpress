// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../app/skins/default.css", import.meta.url),
  "utf8",
);
const palettes = [
  ...css.matchAll(/\[data-skin="default"\][^{}]*\{([^}]+)\}/g),
].map((match) => match[1] ?? "");

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

  if (!value) {
    throw new Error(`Missing compiled token ${token}`);
  }

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
        ["text", "surface"],
        ["text-muted", "surface"],
        ["link", "surface"],
        ["text", "surface-muted"],
        ["text-muted", "surface-muted"],
        ["link", "surface-muted"],
        ["text-on-action", "action"],
        ["surface-muted", "action"],
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

it("keeps preset roles scoped and supplies Modern mode overrides", () => {
  const preset = readFileSync(
    new URL("../templates/blog/presets.css", import.meta.url),
    "utf8",
  );
  expect(preset).toContain(
    '[data-website-template="blog"][data-style-preset="classic"]',
  );
  expect(preset).not.toContain(":root");
  expect(preset).toContain(
    '[data-style-preset="modern"][data-color-mode="dark"]',
  );
  expect(preset).toContain(
    '[data-style-preset="modern"][data-color-mode="system"]',
  );
  expect(preset).toContain("--blog-display-size:");
  expect(preset).toContain("--blog-article-title-size:");
  expect(css).not.toContain(":root");
  expect(palettes[1]).toBeDefined();
  for (const token of [
    "page",
    "surface",
    "surface-muted",
    "text",
    "text-muted",
    "link",
  ]) {
    expect(color(palettes[1] ?? "", token)).toBe(
      color(palettes[2] ?? "", token),
    );
  }
});

it("defines mode-aware inverse roles for the planned Modern footer", () => {
  expect(css).toContain("--color-surface-inverse: var(--color-action)");
  expect(css).toContain("--color-text-inverse: var(--color-text-on-action)");
  expect(css).toContain(
    "--color-text-inverse-muted: var(--color-surface-muted)",
  );
  expect(css).toContain("--color-link-inverse: var(--color-text-on-action)");
  expect(css).toContain("--color-focus-inverse: var(--color-text-on-action)");
});
it("keeps Modern text and focus contrast on paper, cards and inverse footer", () => {
  const preset = readFileSync(
    new URL("../templates/blog/presets.css", import.meta.url),
    "utf8",
  );
  const modernPalettes = [
    ...preset.matchAll(/\[data-style-preset="modern"\][^{}]*\{([^}]+)\}/g),
  ].map((match) => match[1] ?? "");
  expect(modernPalettes).toHaveLength(3);

  for (const palette of modernPalettes) {
    const backgroundTokens = [
      "color-page",
      "blog-card-background",
      "blog-card-alternate",
    ];

    const tokenValue = (name: string) => {
      const value = palette.match(
        new RegExp(`--${name}: (#[a-f0-9]{6});`),
      )?.[1];

      if (!value) {
        throw new Error(`Missing ${name}`);
      }

      return luminance(value);
    };

    for (const background of backgroundTokens) {
      for (const foreground of [
        "color-text",
        "color-text-muted",
        "color-link",
        "color-focus-ring",
      ]) {
        const first = tokenValue(foreground);
        const second = tokenValue(background);
        const minimum = foreground === "color-focus-ring" ? 3 : 4.5;
        expect(
          (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  }
  expect(
    (luminance("#f4f0e9") + 0.05) / (luminance("#1d1c32") + 0.05),
  ).toBeGreaterThanOrEqual(4.5);
});
it.each(["classic", "minimal"])(
  "keeps %s light/dark text and accent contrast",
  (name) => {
    const preset = readFileSync(
      new URL("../templates/blog/presets.css", import.meta.url),
      "utf8",
    );
    const palette =
      preset.match(
        new RegExp(`\\[data-style-preset="${name}"\\] \\{([^}]+)\\}`),
      )?.[1] ?? "";

    for (const mode of [0, 1]) {
      const value = (token: string) => {
        const match = palette.match(
          new RegExp(
            `--color-${token}: light-dark\\((#[a-f0-9]{6}), (#[a-f0-9]{6})\\)`,
          ),
        );
        const hex = match?.[mode + 1];

        if (!hex) {
          throw new Error(`Missing ${name}/${token}/${mode}`);
        }

        return luminance(hex);
      };

      for (const background of ["page", "surface", "surface-muted"]) {
        for (const foreground of ["text", "text-muted", "link", "focus-ring"]) {
          const first = value(foreground);
          const second = value(background);
          const minimum = foreground === "focus-ring" ? 3 : 4.5;
          expect(
            (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05),
          ).toBeGreaterThanOrEqual(minimum);
        }
      }
    }
  },
);
