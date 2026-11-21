import { prisma } from "@nextpress/db";
import {
  maxMenuDepth,
  NavigationHrefSchema,
} from "@nextpress/shared/api-contracts";

import type { Prisma } from "@nextpress/db";
import type { NavigationMenuInput } from "@nextpress/shared/api-contracts";

export class InvalidMenuError extends Error {}
export class MenuConflictError extends Error {}

const menuInclude = {
  assignments: { select: { location: true } },
  items: { orderBy: [{ position: "asc" }, { id: "asc" }] },
} satisfies Prisma.NavigationMenuInclude;

export async function listMenus() {
  const rows = await prisma.navigationMenu.findMany({
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: menuInclude,
  });

  return rows.map(({ assignments, items, ...menu }) => ({
    ...menu,
    locations: assignments.map(({ location }) => location),
    items: items.map(({ id, parentId, kind, label, value, newTab }) => ({
      id,
      parentId,
      kind,
      label,
      value,
      newTab,
    })),
  }));
}

export function validateMenu(menu: NavigationMenuInput) {
  const byId = new Map(menu.items.map((item) => [item.id, item]));

  if (
    byId.size !== menu.items.length ||
    new Set(menu.locations).size !== menu.locations.length
  ) {
    throw new InvalidMenuError("Duplicate menu item or location");
  }

  for (const item of menu.items) {
    const ancestors = new Set([item.id]);
    let parentId = item.parentId;

    while (parentId) {
      const parent = byId.get(parentId);

      if (
        !parent ||
        ancestors.has(parentId) ||
        ancestors.size >= maxMenuDepth
      ) {
        throw new InvalidMenuError("Invalid menu hierarchy");
      }

      ancestors.add(parentId);
      parentId = parent.parentId;
    }

    if (item.kind === "internal" || item.kind === "external") {
      if (
        !NavigationHrefSchema.safeParse(item.value).success ||
        (item.kind === "internal") !== item.value.startsWith("/")
      ) {
        throw new InvalidMenuError("Invalid menu URL");
      }
    }

    if (item.kind === "group" ? !item.label : !item.value) {
      throw new InvalidMenuError(
        "Each item needs a destination or group label",
      );
    }
  }
}

export async function saveMenu(
  input: NavigationMenuInput,
  existing?: { id: string; version: number },
) {
  validateMenu(input);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261121::bigint)`;

    const occupied = await tx.navigationAssignment.findFirst({
      where: {
        location: { in: input.locations },
        ...(existing && { menuId: { not: existing.id } }),
      },
      select: { location: true },
    });

    if (occupied) {
      throw new MenuConflictError(
        `Release the ${occupied.location} location from its current menu first`,
      );
    }

    for (const kind of ["content", "taxonomy"] as const) {
      const values = [
        ...new Set(
          input.items
            .filter((item) => item.kind === kind)
            .map((item) => item.value),
        ),
      ];
      const count =
        kind === "content"
          ? await tx.page.count({ where: { id: { in: values } } })
          : await tx.taxonomy.count({ where: { id: { in: values } } });

      if (count !== values.length) {
        throw new InvalidMenuError("A referenced destination no longer exists");
      }
    }

    let id: string;

    if (existing) {
      const updated = await tx.navigationMenu.updateMany({
        where: existing,
        data: { name: input.name, version: { increment: 1 } },
      });

      if (!updated.count) {
        throw new MenuConflictError("This menu changed. Reload before saving.");
      }

      id = existing.id;
      await tx.navigationAssignment.deleteMany({ where: { menuId: id } });
      await tx.navigationItem.deleteMany({ where: { menuId: id } });
    } else {
      const menu = await tx.navigationMenu.create({
        data: { name: input.name },
      });
      id = menu.id;
    }

    await tx.navigationAssignment.createMany({
      data: input.locations.map((location) => ({ location, menuId: id })),
    });
    await tx.navigationItem.createMany({
      data: input.items.map((item, position) => ({
        ...item,
        menuId: id,
        position,
      })),
    });

    return { id };
  });
}

export async function deleteMenu(id: string, version: number) {
  const deleted = await prisma.navigationMenu.deleteMany({
    where: { id, version },
  });

  if (!deleted.count) {
    throw new MenuConflictError("This menu changed. Reload before deleting.");
  }
}
