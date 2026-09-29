import { describe, expect, it } from "vitest";

import { isProviderAvatar, normalizeAvatarUrl } from "./UserAvatar.utils";

describe("avatar URL helpers", () => {
  it("adds provider-specific size parameters", () => {
    expect(normalizeAvatarUrl("https://avatars.githubusercontent.com/u/1", 64)).toBe(
      "https://avatars.githubusercontent.com/u/1?s=64"
    );
    expect(normalizeAvatarUrl("https://cdn.discordapp.com/avatar.png", 64)).toBe(
      "https://cdn.discordapp.com/avatar.png?size=64"
    );
    expect(normalizeAvatarUrl("https://pbs.twimg.com/profile.jpg", 40)).toContain("name=small");
    expect(normalizeAvatarUrl("https://pbs.twimg.com/profile.jpg", 96)).toContain("name=normal");
    expect(normalizeAvatarUrl("https://pbs.twimg.com/profile.jpg", 128)).toContain("name=bigger");
  });

  it("preserves existing provider parameters and unrelated URLs", () => {
    const existing = "https://lh3.googleusercontent.com/a/photo?sz=64";
    expect(normalizeAvatarUrl(existing, 128)).toBe(existing);
    expect(normalizeAvatarUrl("https://example.com/avatar.png", 64)).toBe(
      "https://example.com/avatar.png"
    );
  });

  it("identifies known provider hosts", () => {
    expect(isProviderAvatar("https://avatars.githubusercontent.com/u/1")).toBe(true);
    expect(isProviderAvatar(null)).toBe(false);
    expect(isProviderAvatar("https://example.com/avatar.png")).toBe(false);
  });
});
