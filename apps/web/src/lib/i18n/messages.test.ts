import { describe, expect, it } from "vitest";

import {
  en,
  hu,
  messages,
  getMessage,
  getMessages,
  isLocale,
  isColorMode,
  loadedMessage,
} from "./messages";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function placeholders(value: string) {
  return [...new Set(value.match(/\{[a-zA-Z]\w*\}/g) ?? [])].sort().join(",");
}

function translationIssues(
  reference: unknown,
  candidate: unknown,
  path = "",
): string[] {
  if (typeof reference === "string") {
    if (typeof candidate !== "string" || !candidate.trim()) {
      return [`Invalid message: ${path}`];
    }
    if (placeholders(reference) !== placeholders(candidate)) {
      return [`Mismatched placeholders: ${path}`];
    }

    return [];
  }
  if (!isRecord(reference) || !isRecord(candidate)) {
    return [`Mismatched structure: ${path}`];
  }

  const issues: string[] = [];

  for (const [key, value] of Object.entries(reference)) {
    const messagePath = path ? `${path}.${key}` : key;

    if (!Object.hasOwn(candidate, key)) {
      issues.push(`Missing key: ${messagePath}`);
    } else {
      issues.push(...translationIssues(value, candidate[key], messagePath));
    }
  }
  for (const key of Object.keys(candidate)) {
    if (!Object.hasOwn(reference, key)) {
      issues.push(`Extra key: ${path ? `${path}.` : ""}${key}`);
    }
  }

  return issues;
}

describe("JSON translation catalogs", () => {
  it.each(Object.entries(messages))(
    "validates all keys, values and placeholders in %s",
    (_locale, catalog) => {
      expect(translationIssues(en, catalog)).toEqual([]);
    },
  );
  it("reports missing and extra nested keys", () => {
    expect(
      translationIssues(
        { posts: { all: "All posts" } },
        { posts: { unexpected: "Extra" } },
      ),
    ).toEqual(["Missing key: posts.all", "Extra key: posts.unexpected"]);
  });
  it.each([null, [], 3, "Posts"])(
    "rejects a mismatched feature structure: %j",
    (posts) => {
      expect(
        translationIssues({ posts: { all: "All posts" } }, { posts }),
      ).toEqual(["Mismatched structure: posts"]);
    },
  );
  it.each([null, [], 3, ""])("rejects an invalid message leaf: %j", (all) => {
    expect(
      translationIssues({ posts: { all: "All posts" } }, { posts: { all } }),
    ).toEqual(["Invalid message: posts.all"]);
  });
  it("rejects mismatched interpolation placeholders", () => {
    expect(
      translationIssues(
        { loaded: "{count} posts. Page {page}." },
        { loaded: "{total} posts." },
      ),
    ).toEqual(["Mismatched placeholders: loaded"]);
  });
  it("uses English as the default and unsupported-locale fallback", () => {
    expect(getMessages()).toBe(en);
    expect(getMessages("fr")).toBe(en);
    expect(getMessage(undefined, "navigation.home")).toBe("Home");
    expect(getMessage("../hu", "appearance.dark")).toBe("Dark");
    expect(getMessages("hu")).toBe(hu);
    expect(getMessage("hu", "navigation.home")).toBe(hu.navigation.home);
  });
});

describe("visitor preferences", () => {
  it("allows only supported locales and modes", () => {
    for (const value of [null, "../../hu", "HU", "fr", {}]) {
      expect(isLocale(value)).toBe(false);
    }
    expect(isColorMode("system")).toBe(true);
    expect(isColorMode("auto")).toBe(false);
  });
  it("interpolates localized load announcements", () => {
    expect(loadedMessage("hu", 2, 3)).toContain("Oldal: 3");
    expect(loadedMessage("en", 1, 2)).toBe("Loaded 1 more post. Page 2.");
    expect(loadedMessage("en", 2, 3)).toBe("Loaded 2 more posts. Page 3.");
    expect(loadedMessage("en", 0, 1)).toBe("Loaded 0 more posts. Page 1.");
  });
});
