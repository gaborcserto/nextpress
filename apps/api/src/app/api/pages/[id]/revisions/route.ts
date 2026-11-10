import { RevisionActionSchema } from "@nextpress/shared/revisions";
import { ZodError } from "zod";

import { ok, bad, conflict, forbid, notfound, oops } from "@/lib/api";
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
  if (error instanceof ZodError) return bad("Invalid revision request");
  if (error instanceof ContentForbiddenError) return forbid();
  if (error instanceof ContentNotFoundError) return notfound();
  if (error instanceof RevisionConflictError)
    return conflict("Content changed; reload before saving");
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
    return conflict("Slug already exists");

  return oops();
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
      console.info(
        JSON.stringify({
          event: "revision.saved",
          actorId: session.user.id,
          pageId: ctx.params.id,
          revisionId: revision.id,
        }),
      );

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
      const result = await revisionAction(ctx.params.id, action, session.user);
      console.info(
        JSON.stringify({
          event: "revision.transition",
          action: action.action,
          actorId: session.user.id,
          pageId: ctx.params.id,
          resultId: result.id,
        }),
      );

      return ok(result);
    } catch (error) {
      return failure(error);
    }
  },
  "create-content",
);
