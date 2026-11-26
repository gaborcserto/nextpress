import { describe, expect, it } from "vitest";

import {
  flattenMenuItems,
  menuDropPlaceholderIndex,
  moveMenuItem,
  moveMenuItemRelative,
  projectMenuItemDrop,
  projectMenuItemMove,
} from "./menu-items";

import type { NavigationItemInput } from "@nextpress/shared/api-contracts";

function group(
  id: string,
  parentId: string | null = null,
): NavigationItemInput {
  return { id, parentId, kind: "group", label: id, value: "", newTab: false };
}

describe("moveMenuItem", () => {
  it("moves a subtree in and out of another branch without changing descendant relationships", () => {
    const child = group("child", "branch");
    const items = [group("branch"), child, group("target")];

    const nested = moveMenuItem(items, "branch", "target");

    expect(nested).toEqual([child, group("target"), group("branch", "target")]);
    expect(moveMenuItem(nested ?? [], "branch", null, "target")).toEqual([
      child,
      group("branch"),
      group("target"),
    ]);
  });

  it("changes sibling order without rewriting their parent", () => {
    const root = group("root");
    const first = group("first", root.id);
    const second = group("second", root.id);

    expect(
      moveMenuItem([root, first, second], "second", root.id, "first"),
    ).toEqual([root, second, first]);
  });

  it("rejects cycles and moves exceeding the maximum depth", () => {
    const items = [
      group("a"),
      group("b", "a"),
      group("c", "b"),
      group("d", "c"),
      group("e", "d"),
      group("other"),
    ];

    expect(moveMenuItem(items, "a", "b")).toBeNull();
    expect(moveMenuItem(items, "other", "e")).toBeNull();
  });
});

describe("moveMenuItemRelative", () => {
  it("moves before, after, and inside a hovered item", () => {
    const items = [group("first"), group("second"), group("third")];

    expect(moveMenuItemRelative(items, "third", "second", "before")).toEqual([
      group("first"),
      group("third"),
      group("second"),
    ]);
    expect(moveMenuItemRelative(items, "first", "second", "after")).toEqual([
      group("second"),
      group("first"),
      group("third"),
    ]);
    expect(moveMenuItemRelative(items, "third", "first", "inside")).toEqual([
      group("first"),
      group("second"),
      group("third", "first"),
    ]);
  });

  it("moves outdent drops beside the hovered item's parent and rejects cycles", () => {
    const items = [group("parent"), group("child", "parent"), group("other")];

    expect(moveMenuItemRelative(items, "other", "child", "outdent")).toEqual([
      group("other"),
      group("parent"),
      group("child", "parent"),
    ]);
    expect(moveMenuItemRelative(items, "parent", "child", "inside")).toBeNull();
  });
});

describe("flattenMenuItems", () => {
  it("keeps descendants after their parent with an explicit depth", () => {
    const items = [
      group("first"),
      group("second"),
      group("child", "first"),
      group("grandchild", "child"),
    ];

    expect(flattenMenuItems(items)).toEqual([
      { item: group("first"), depth: 0 },
      { item: group("child", "first"), depth: 1 },
      { item: group("grandchild", "child"), depth: 2 },
      { item: group("second"), depth: 0 },
    ]);
  });
});

describe("projectMenuItemDrop", () => {
  it("projects before the first item, between siblings, and after the last item", () => {
    const items = [group("first"), group("second"), group("third")];
    const beforeFirst = projectMenuItemDrop(items, "third", 0, 0);
    const afterLast = projectMenuItemDrop(items, "first", 2, 0);

    expect(beforeFirst).toMatchObject({
      parentId: null,
      beforeId: "first",
      depth: 0,
      index: 0,
    });
    expect(beforeFirst && menuDropPlaceholderIndex(items, beforeFirst)).toBe(0);
    expect(projectMenuItemDrop(items, "third", 1, 0)).toMatchObject({
      parentId: null,
      beforeId: "second",
      depth: 0,
      index: 1,
    });
    expect(afterLast).toMatchObject({
      parentId: null,
      depth: 0,
      index: 2,
    });
    expect(afterLast && menuDropPlaceholderIndex(items, afterLast)).toBe(3);
  });

  it("projects horizontal indentation under the first item and clamps invalid cycles", () => {
    const items = [group("first"), group("second"), group("third")];
    const nested = projectMenuItemDrop(items, "third", 1, 1);

    expect(nested).toMatchObject({
      parentId: "first",
      depth: 1,
      index: 1,
    });
    expect(
      projectMenuItemDrop(
        [group("first"), group("child", "first")],
        "first",
        1,
        1,
        "child",
      ),
    ).toBeNull();
  });

  it("reduces nesting when moved left and places the placeholder at that sibling slot", () => {
    const items = [group("first"), group("child", "first"), group("last")];
    const projection = projectMenuItemDrop(items, "child", 1, 0);

    expect(projection).toMatchObject({
      parentId: null,
      beforeId: "last",
      depth: 0,
      index: 1,
    });
    expect(projection && menuDropPlaceholderIndex(items, projection)).toBe(2);
  });

  it("keeps an item's current position when its drag starts", () => {
    const items = [group("first"), group("child", "first"), group("last")];

    expect(projectMenuItemMove(items, "child", "first")).toMatchObject({
      parentId: "first",
      depth: 1,
      index: 1,
    });
  });
});
