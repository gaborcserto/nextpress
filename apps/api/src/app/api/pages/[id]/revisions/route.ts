import { RevisionActionSchema } from "@nextpress/shared/revisions";
import { writeServerLog } from "@nextpress/shared/server-logging";
import { ZodError } from "zod";

import { ok, bad, conflict, forbid, notfound, oops } from "@/lib/api";
import { apiLogContext } from "@/lib/api/request-log-context.server";
import { withAuth } from "@/lib/auth/auth-server";
import {
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import {
  listRevisions,
  previewRevision,
  revisionAction,
  RevisionConflictError,
  saveRevision,
} from "@/lib/services/revisions.server";

function failure(error: unknown) {
  if (error instanceof ZodError) {
    return bad("Invalid revision request");
  }

  if (error instanceof ContentForbiddenError) {
    return forbid();
  }

  if (error instanceof ContentNotFoundError) {
    return notfound();
  }

  if (error instanceof RevisionConflictError) {
    return conflict("Content changed; reload before saving");
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return conflict("Slug already exists");
  }

  return oops(error);
}

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, ctx, { session }) => {
    try {
      const revisionId = new URL(req.url).searchParams.get("revisionId");
      const result = revisionId
        ? await previewRevision(ctx.params.id, revisionId, session.user)
        : await listRevisions(ctx.params.id, session.user);

      const response = ok(result);
      response.headers.set("Cache-Control", "private, no-store");

      return response;
    } catch (error) {
      return failure(error);
    }
  },
);

export const POST = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, ctx, { session }) => {
    let input: unknown;

    try {
      input = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const revision = await saveRevision(ctx.params.id, input, session.user);
      writeServerLog("api", "revision.saved", {
        ...apiLogContext(),
        actorId: session.user.id,
        targetId: revision.pageId,
        revisionId: revision.id,
      });

      return ok(revision, 201);
    } catch (error) {
      return failure(error);
    }
  },
  "create-content",
);

export const PATCH = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, ctx, { session }) => {
    let input: unknown;

    try {
      input = await req.json();
    } catch {
      return bad("Invalid JSON");
    }

    try {
      const action = RevisionActionSchema.parse(input);

      const { result, audit } = await revisionAction(
        ctx.params.id,
        action,
        session.user,
      );

      writeServerLog("api", "revision.transition", {
        ...apiLogContext(),
        actorId: session.user.id,
        ...audit,
      });

      return ok(result);
    } catch (error) {
      return failure(error);
    }
  },
  "create-content",
);
