import { beforeEach, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  menuCreate: vi.fn(),
  assignmentCreateMany: vi.fn(),
  itemCreateMany: vi.fn(),
  menuFindMany: vi.fn(),
  pageUpdate: vi.fn(),
}));

vi.mock("@nextpress/db", () => ({
  prisma: {
    navigationMenu: { findMany: database.menuFindMany },
    $transaction: (operation: (tx: unknown) => unknown) =>
      operation({
        $executeRaw: vi.fn(),
        navigationAssignment: {
          findFirst: vi.fn().mockResolvedValue(null),
          createMany: database.assignmentCreateMany,
        },
        navigationMenu: {
          create: database.menuCreate,
        },
        navigationItem: { createMany: database.itemCreateMany },
        page: {
          count: vi.fn().mockResolvedValue(0),
          update: database.pageUpdate,
        },
        taxonomy: { count: vi.fn().mockResolvedValue(0) },
      }),
  },
}));

import { listMenus, saveMenu } from "./navigation";

beforeEach(() => {
  vi.resetAllMocks();
  database.menuCreate.mockResolvedValue({ id: "menu-1" });
});

it("persists menu order, nesting and location without changing page hierarchy", async () => {
  await saveMenu({
    name: "Header",
    locations: ["header"],
    items: [
      {
        id: "first",
        parentId: null,
        kind: "external",
        label: "First",
        value: "https://example.test/first",
        newTab: false,
        visible: true,
      },
      {
        id: "group",
        parentId: null,
        kind: "group",
        label: "More",
        value: "",
        newTab: false,
        visible: true,
      },
      {
        id: "nested",
        parentId: "group",
        kind: "internal",
        label: "Nested",
        value: "/nested",
        newTab: false,
        visible: false,
      },
    ],
  });

  expect(database.itemCreateMany).toHaveBeenCalledWith({
    data: [
      expect.objectContaining({
        id: "first",
        position: 0,
        parentId: null,
        visible: true,
      }),
      expect.objectContaining({ id: "group", position: 1, parentId: null }),
      expect.objectContaining({
        id: "nested",
        position: 2,
        parentId: "group",
        visible: false,
      }),
    ],
  });
  expect(database.assignmentCreateMany).toHaveBeenCalledWith({
    data: [{ location: "header", menuId: "menu-1" }],
  });
  expect(database.pageUpdate).not.toHaveBeenCalled();
});

it("reloads saved item order and manual visibility from the menu list", async () => {
  database.menuFindMany.mockResolvedValue([
    {
      id: "menu-1",
      name: "Header",
      version: 1,
      assignments: [{ location: "header" }],
      items: [
        {
          id: "second",
          parentId: null,
          kind: "external",
          label: "Second",
          value: "https://example.test/second",
          newTab: false,
          visible: false,
        },
        {
          id: "first",
          parentId: null,
          kind: "group",
          label: "First",
          value: "",
          newTab: false,
          visible: true,
        },
      ],
    },
  ]);

  const [menu] = await listMenus();

  expect(database.menuFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      include: expect.objectContaining({
        items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
      }),
    }),
  );
  expect(menu?.items.map(({ id, visible }) => ({ id, visible }))).toEqual([
    { id: "second", visible: false },
    { id: "first", visible: true },
  ]);
});
