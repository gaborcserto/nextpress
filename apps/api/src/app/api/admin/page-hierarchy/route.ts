import { prisma } from "@nextpress/db";
import { PageHierarchyMutationSchema } from "@nextpress/shared/api-contracts";
import { isPagePath, maxPageDepth } from "@nextpress/shared/content";
import { writeServerLog } from "@nextpress/shared/server-logging";

import { bad, conflict, notfound, ok, oops } from "@/lib/api/http";
import { apiLogContext } from "@/lib/api/request-log-context.server";
import { withAuth } from "@/lib/auth/auth-server";

export const GET = withAuth(["ADMIN", "EDITOR"], async () => {
  try {
    const response = ok(
      await prisma.page.findMany({
        where: { type: "PAGE" },
        select: {
          id: true,
          slug: true,
          layout: true,
          title: true,
          parentId: true,
          siblingOrder: true,
        },
        orderBy: [{ siblingOrder: "asc" }, { id: "asc" }],
      }),
    );
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    return oops(error);
  }
});

export const PUT = withAuth(
  ["ADMIN", "EDITOR"],
  async (request, _context, { session }) => {
    const parsed = PageHierarchyMutationSchema.safeParse(
      await request.json().catch(() => null),
    );

    if (!parsed.success) {
      return bad("Invalid Page hierarchy request");
    }

    const {
      id,
      parentId,
      siblingOrder,
      previousParentId,
      previousSiblingOrder,
    } = parsed.data;

    try {
      const response = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261122::bigint)`;
        const current = await tx.page.findFirst({
          where: { id, type: "PAGE" },
        });

        if (!current) {
          return notfound();
        }

        if (
          current.parentId !== previousParentId ||
          current.siblingOrder !== previousSiblingOrder
        ) {
          return conflict("Page hierarchy changed. Reload before saving.");
        }

        if (parentId && current.layout === "HOME") {
          return bad("A Home Page must remain at the root");
        }

        const segments = [current.slug];
        const visited = new Set([id]);
        let nextParent = parentId;

        while (nextParent) {
          if (visited.has(nextParent) || segments.length >= maxPageDepth) {
            return bad("Invalid Page hierarchy");
          }

          const parent = await tx.page.findFirst({
            where: { id: nextParent, type: "PAGE" },
            select: { slug: true, parentId: true },
          });

          if (!parent) {
            return bad("Parent Page was not found");
          }

          visited.add(nextParent);
          segments.unshift(parent.slug);
          nextParent = parent.parentId;
        }

        if (parentId && !isPagePath(segments)) {
          return bad("The Page path conflicts with a reserved route");
        }

        let descendants = [id];

        for (
          let depth = segments.length;
          descendants.length && depth <= maxPageDepth;
          depth++
        ) {
          const children = await tx.page.findMany({
            where: { parentId: { in: descendants }, type: "PAGE" },
            select: { id: true },
          });
          descendants = children.map((child) => child.id);
        }

        if (descendants.length) {
          return bad("This move would exceed the maximum Page depth");
        }

        await tx.page.update({
          where: { id },
          data: { parentId, siblingOrder },
        });

        return ok({ id, parentId, siblingOrder });
      });

      if (response.ok) {
        writeServerLog("api", "page.hierarchy.updated", {
          ...apiLogContext(),
          actorId: session.user.id,
          targetId: id,
        });
      }

      return response;
    } catch (error) {
      return oops(error);
    }
  },
  "settings",
);
