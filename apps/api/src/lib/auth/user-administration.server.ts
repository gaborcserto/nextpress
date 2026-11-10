import "server-only";

import { prisma } from "@nextpress/db/src/client";

import type { ContentActor } from "./content-access";
import type { RoleName } from "./roles";

export class LastAdministratorError extends Error {}

export async function administerUser(
  actor: ContentActor,
  userId: string,
  role: RoleName | null,
) {
  if (actor.role !== "ADMIN") throw new Error("Forbidden");

  return prisma.$transaction(async (tx) => {
    // Serialize demotion/deletion across processes before counting administrators.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(71520261110::bigint)`;
    const target = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: { select: { name: true } } },
    });

    if (target.role?.name === "ADMIN" && role !== "ADMIN") {
      const administrators = await tx.user.count({
        where: { role: { name: "ADMIN" } },
      });

      if (administrators <= 1) throw new LastAdministratorError();
    }

    if (role === null) {
      await tx.user.delete({ where: { id: userId } });

      return null;
    }

    return tx.user.update({
      where: { id: userId },
      data: { role: { connect: { name: role } } },
      select: { id: true, role: { select: { name: true } } },
    });
  });
}
