import "server-only";

import { prisma } from "@nextpress/db";
import {
  maxMenuDepth,
  maxMenuItems,
  NavigationHrefSchema,
} from "@nextpress/shared/api-contracts";
import { pageLayouts } from "@nextpress/shared/content";

import { publishedPagePaths } from "@/lib/repos/page-hierarchy";

import { publicPublicationWhere } from "./eligibility";

import type { PublicMenuItem } from "@nextpress/shared/api-contracts";

export async function getPublicMenus() {
  return prisma.$transaction(
    async (tx) => {
      const assignments = await tx.navigationAssignment.findMany({
        include: {
          menu: {
            select: {
              items: {
                orderBy: [{ position: "asc" }, { id: "asc" }],
                take: maxMenuItems,
              },
            },
          },
        },
      });

      const items = assignments.flatMap(({ menu }) => menu.items);

      const ids = (kind: "content" | "taxonomy") =>
        items.filter((item) => item.kind === kind).map((item) => item.value);
      const now = new Date();

      const [content, taxonomies] = await Promise.all([
        tx.page.findMany({
          where: { id: { in: ids("content") }, ...publicPublicationWhere(now) },
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            layout: true,
          },
        }),
        tx.taxonomy.findMany({
          where: {
            id: { in: ids("taxonomy") },
            type: { in: ["CATEGORY", "TAG"] },
          },
          select: { id: true, type: true, slug: true, name: true },
        }),
      ]);

      const paths = await publishedPagePaths(
        tx,
        content
          .filter(
            (row) => row.type === "PAGE" && row.layout !== pageLayouts.posts,
          )
          .map(({ id }) => id),
        now,
      );
      const destinations = new Map<string, { href: string; label: string }>();

      for (const row of content) {
        const href =
          row.type === "POST"
            ? `/posts/${row.slug}`
            : row.layout === pageLayouts.posts
              ? "/posts"
              : paths.get(row.id);

        if (href) {
          destinations.set(`content:${row.id}`, { href, label: row.title });
        }
      }

      for (const row of taxonomies) {
        const base = row.type === "CATEGORY" ? "/categories" : "/tags";
        destinations.set(`taxonomy:${row.id}`, {
          href: `${base}/${row.slug}`,
          label: row.name,
        });
      }

      const menus: Record<"header" | "footer" | "sidebar", PublicMenuItem[]> = {
        header: [],
        footer: [],
        sidebar: [],
      };

      for (const { location, menu } of assignments) {
        const output = menus[location];

        function append(
          parentId: string | null,
          parent: number | null,
          depth: number,
        ) {
          if (depth > maxMenuDepth) {
            return;
          }

          for (const item of menu.items) {
            if (item.parentId !== parentId || item.visible === false) {
              continue;
            }

            const managed = item.kind === "content" || item.kind === "taxonomy";
            const target = destinations.get(`${item.kind}:${item.value}`);

            if (managed && !target) {
              continue;
            }

            const href =
              item.kind === "group" ? null : (target?.href ?? item.value);

            if (
              href !== null &&
              !NavigationHrefSchema.safeParse(href).success
            ) {
              continue;
            }

            const index = output.length;
            output.push({
              parent,
              href,
              label: item.label || target?.label || href || "",
              newTab: item.newTab,
            });
            append(item.id, index, depth + 1);

            if (href === null && output.length === index + 1) {
              output.pop();
            }
          }
        }

        append(null, null, 1);
      }

      return menus;
    },
    { isolationLevel: "RepeatableRead" },
  );
}
