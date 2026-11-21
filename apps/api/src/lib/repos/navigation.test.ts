import { describe, expect, it, vi } from "vitest";

import { InvalidMenuError, validateMenu } from "./navigation";

import type { NavigationItemInput } from "@nextpress/shared/api-contracts";

vi.mock("@nextpress/db", () => ({ prisma: {} }));

const link: NavigationItemInput = {
  id: "link",
  parentId: null,
  kind: "external",
  value: "https://example.com",
  label: "Example",
  newTab: false,
};

describe("menu snapshot validation", () => {
  it("accepts nested links in a single editable snapshot", () => {
    expect(() =>
      validateMenu({
        name: "Header",
        locations: ["header"],
        items: [link, { ...link, id: "child", parentId: link.id }],
      }),
    ).not.toThrow();
  });

  it.each([
    "javascript:alert(1)",
    "//example.com",
    "https://example.com@other.example",
    "/\\\\example.com",
  ])("rejects an unsafe external destination %s", (value) => {
    expect(() =>
      validateMenu({
        name: "Header",
        locations: [],
        items: [{ ...link, value }],
      }),
    ).toThrow(InvalidMenuError);
  });

  it("rejects cycles and references outside the menu", () => {
    const cyclic = [
      { ...link, parentId: "child" },
      { ...link, id: "child", parentId: "link" },
    ];

    expect(() =>
      validateMenu({ name: "Header", locations: [], items: cyclic }),
    ).toThrow("Invalid menu hierarchy");
    expect(() =>
      validateMenu({
        name: "Header",
        locations: [],
        items: [{ ...link, parentId: "other-menu" }],
      }),
    ).toThrow("Invalid menu hierarchy");
  });

  it("rejects adding a sixth level", () => {
    const items = Array.from({ length: 6 }, (_, index) => ({
      ...link,
      id: String(index),
      parentId: index ? String(index - 1) : null,
    }));

    expect(() =>
      validateMenu({ name: "Header", locations: [], items }),
    ).toThrow("Invalid menu hierarchy");
  });
});
