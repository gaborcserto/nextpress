import "server-only";

import { prisma } from "@nextpress/db/src/client";

import type { RoleName } from "./roles";
import type { Prisma } from "@nextpress/db/generated/prisma/client";

export type ContentActor = { id: string; role: RoleName | null };
export type ContentType = "PAGE" | "POST";

export class ContentForbiddenError extends Error {}
export class ContentNotFoundError extends Error {}

export function isEditor(actor?: ContentActor | null): boolean {
  return actor?.role === "ADMIN" || actor?.role === "EDITOR";
}

export function contentReadWhere(actor?: ContentActor | null): Pick<Prisma.PageWhereInput, "OR" | "status"> {
  if (isEditor(actor)) return {};
  const published: Pick<Prisma.PageWhereInput, "OR" | "status"> = {
    status: "PUBLISHED",
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
  };
  if (actor?.role === "AUTHOR") {
    return { OR: [published, { authorId: actor.id }] };
  }
  return published;
}

export function contentWriteWhere(actor: ContentActor) {
  if (isEditor(actor)) return {};
  if (actor.role === "AUTHOR") return { authorId: actor.id };
  throw new ContentForbiddenError();
}

export async function requireContentWrite(
  id: string,
  actor: ContentActor,
  type?: ContentType,
  deleting = false,
) {
  const scope = contentWriteWhere(actor);
  if (deleting && !isEditor(actor)) throw new ContentForbiddenError();
  const item = await prisma.page.findUnique({ where: { id } });
  if (!item || (type && item.type !== type)) throw new ContentNotFoundError();
  if (scope.authorId && item.authorId !== scope.authorId) throw new ContentForbiddenError();
  return item;
}
