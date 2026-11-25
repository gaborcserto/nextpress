import { PublicMenusSchema } from "@nextpress/shared/api-contracts";
import { beforeEach, expect, it, vi } from "vitest";

const { assignmentFindMany, pageFindMany, taxonomyFindMany } = vi.hoisted(
  () => ({
    assignmentFindMany: vi.fn(),
    pageFindMany: vi.fn(),
    taxonomyFindMany: vi.fn(),
  }),
);

vi.mock("@nextpress/db", () => ({
  prisma: {
    $transaction: (run: (tx: unknown) => unknown) =>
      run({
        navigationAssignment: { findMany: assignmentFindMany },
        page: { findMany: pageFindMany },
        taxonomy: { findMany: taxonomyFindMany },
      }),
  },
}));

import { getPublicMenus } from "./menus.server";

beforeEach(() => {
  vi.resetAllMocks();
  assignmentFindMany.mockResolvedValue([]);
  pageFindMany.mockResolvedValue([]);
  taxonomyFindMany.mockResolvedValue([]);
});

it("returns validated empty menus when no locations are assigned", async () => {
  const menus = await getPublicMenus();

  expect(PublicMenusSchema.parse(menus)).toEqual({
    header: [],
    footer: [],
    sidebar: [],
  });
  expect(pageFindMany).toHaveBeenCalledOnce();
  expect(taxonomyFindMany).toHaveBeenCalledOnce();
});

it("projects assigned header, footer and sidebar items in order with nesting", async () => {
  assignmentFindMany.mockResolvedValue([
    {
      location: "header",
      menu: {
        items: [
          {
            id: "group",
            parentId: null,
            position: 0,
            kind: "group",
            value: "",
            label: "Explore",
            newTab: false,
          },
          {
            id: "post-link",
            parentId: "group",
            position: 0,
            kind: "content",
            value: "published-post",
            label: "",
            newTab: false,
          },
        ],
      },
    },
    {
      location: "footer",
      menu: {
        items: [
          {
            id: "footer-link",
            parentId: null,
            position: 0,
            kind: "external",
            value: "https://example.test/about",
            label: "About",
            newTab: true,
          },
        ],
      },
    },
    {
      location: "sidebar",
      menu: {
        items: [
          {
            id: "sidebar-link",
            parentId: null,
            position: 0,
            kind: "internal",
            value: "/help",
            label: "Help",
            newTab: false,
          },
        ],
      },
    },
  ]);
  pageFindMany.mockResolvedValue([
    {
      id: "published-post",
      title: "Published post",
      slug: "published-post",
      type: "POST",
    },
  ]);

  const menus = await getPublicMenus();

  expect(PublicMenusSchema.parse(menus)).toEqual({
    header: [
      { parent: null, href: null, label: "Explore", newTab: false },
      {
        parent: 0,
        href: "/posts/published-post",
        label: "Published post",
        newTab: false,
      },
    ],
    footer: [
      {
        parent: null,
        href: "https://example.test/about",
        label: "About",
        newTab: true,
      },
    ],
    sidebar: [{ parent: null, href: "/help", label: "Help", newTab: false }],
  });
});

it("omits a manually hidden parent and its otherwise-visible subtree", async () => {
  assignmentFindMany.mockResolvedValue([
    {
      location: "header",
      menu: {
        items: [
          {
            id: "hidden-group",
            parentId: null,
            position: 0,
            kind: "group",
            value: "",
            label: "Hidden section",
            newTab: false,
            visible: false,
          },
          {
            id: "child",
            parentId: "hidden-group",
            position: 1,
            kind: "external",
            value: "https://example.test/child",
            label: "Visible child",
            newTab: false,
            visible: true,
          },
        ],
      },
    },
  ]);

  expect((await getPublicMenus()).header).toEqual([]);
});

it("omits groups without any visible public children", async () => {
  assignmentFindMany.mockResolvedValue([
    {
      location: "header",
      menu: {
        items: [
          {
            id: "empty-group",
            parentId: null,
            position: 0,
            kind: "group",
            value: "",
            label: "Empty",
            newTab: false,
            visible: true,
          },
        ],
      },
    },
  ]);

  expect((await getPublicMenus()).header).toEqual([]);
});

it("does not expose an unpublished page destination", async () => {
  assignmentFindMany.mockResolvedValue([
    {
      location: "header",
      menu: {
        items: [
          {
            id: "draft-page",
            parentId: null,
            position: 0,
            kind: "content",
            value: "draft-page-id",
            label: "Test",
            newTab: false,
            visible: true,
          },
        ],
      },
    },
  ]);
  pageFindMany.mockResolvedValue([]);

  expect((await getPublicMenus()).header).toEqual([]);
  expect(pageFindMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        status: "PUBLISHED",
        publishedAt: expect.objectContaining({ not: null }),
      }),
    }),
  );
});

it("resolves a Homepage menu reference to the root and uses its page title", async () => {
  assignmentFindMany.mockResolvedValue([
    {
      location: "header",
      menu: {
        items: [
          {
            id: "home-link",
            parentId: null,
            position: 0,
            kind: "content",
            value: "home-page-id",
            label: "",
            newTab: false,
          },
        ],
      },
    },
  ]);
  pageFindMany
    .mockResolvedValueOnce([
      {
        id: "home-page-id",
        title: "Welcome",
        slug: "welcome",
        type: "PAGE",
      },
    ])
    .mockResolvedValueOnce([
      {
        id: "home-page-id",
        parentId: null,
        slug: "welcome",
        layout: "HOME",
      },
    ]);

  const menus = await getPublicMenus();

  expect(menus.header).toEqual([
    { parent: null, href: "/", label: "Welcome", newTab: false },
  ]);
});

it("resolves a Posts page reference to the archive route and uses its title", async () => {
  assignmentFindMany.mockResolvedValue([
    {
      location: "header",
      menu: {
        items: [
          {
            id: "posts-page-link",
            parentId: null,
            position: 0,
            kind: "content",
            value: "posts-page-id",
            label: "",
            newTab: false,
          },
        ],
      },
    },
  ]);
  pageFindMany.mockResolvedValue([
    {
      id: "posts-page-id",
      title: "News archive",
      slug: "news-archive",
      type: "PAGE",
      layout: "POSTS",
    },
  ]);

  const menus = await getPublicMenus();

  expect(menus.header).toEqual([
    { parent: null, href: "/posts", label: "News archive", newTab: false },
  ]);
});
