import { afterEach, describe, expect, it, vi } from "vitest";

import { contentMetadata, siteOrigin } from "./seo";

afterEach(() => vi.unstubAllEnvs());
describe("canonical routing", () => {
  it.each([
    "https://example.com/path",
    "https://name:secret@example.com",
    "javascript:alert(1)",
    "https://example.com?tracking=true",
  ])("rejects invalid site origin %s", (origin) => {
    vi.stubEnv("SITE_URL", origin);
    expect(siteOrigin).toThrow();
  });
  it("requires a configured origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SITE_URL", "");
    expect(siteOrigin).toThrow("SITE_URL is required");
  });
  it("uses one canonical and Open Graph URL without adding empty descriptions", () => {
    vi.stubEnv("SITE_URL", "https://publication.example");
    const metadata = contentMetadata("About", "/pages/about", "");
    expect(metadata.alternates?.canonical).toEqual(
      new URL("https://publication.example/en/pages/about"),
    );
    expect(metadata.openGraph).toMatchObject({
      url: new URL("https://publication.example/en/pages/about"),
    });
    expect(metadata).not.toHaveProperty("description");
  });
});

it.each(["en", "hu"] as const)(
  "uses the %s canonical for original CMS content without false translation alternates",
  (locale) => {
    vi.stubEnv("SITE_URL", "https://publication.example");
    const metadata = contentMetadata(
      "Original title",
      "/posts/original-slug?page=2",
      "Original description",
      locale,
    );
    expect(metadata.alternates?.canonical).toEqual(
      new URL(
        `https://publication.example/${locale}/posts/original-slug?page=2`,
      ),
    );
    expect(metadata.alternates).not.toHaveProperty("languages");
    expect(metadata.openGraph).toMatchObject({
      url: metadata.alternates?.canonical,
      title: "Original title",
    });
  },
);
