import { prisma } from "@nextpress/db/src/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { bad, forbid, notfound, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import {
  PrivateDraftUnavailableError,
  requirePrivateDraftAdmission,
} from "@/lib/services/private-draft-admission.server";
import { WorkingAggregateConflictError } from "@/lib/services/working-aggregate";
import {
  loadWorkingAggregate,
  saveWorkingAggregate,
} from "@/lib/services/working-aggregate-persistence.server";
import { WorkingAggregateSaveSchema } from "@/lib/validation/working-aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const idSchema = WorkingAggregateSaveSchema.shape.pageId;
const requestSchema = WorkingAggregateSaveSchema.omit({ pageId: true });
const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
const conflictReasons = new Set([
  "DRAFT_VERSION_CONFLICT",
  "SOURCE_VERSION_CONFLICT",
  "IDENTITY_CONFLICT",
  "REQUEST_REUSE_CONFLICT",
  "REFERENCE_CONFLICT",
  "MAINTENANCE_CONFLICT",
  "WRITER_FENCE_UNAVAILABLE",
  "WRITER_FENCE_CONFLICT",
  "TRANSACTION_RETRY_REQUIRED",
  "RESET_COMMAND_CONFLICT",
  "RESTORE_COMMAND_CONFLICT",
  "UNSUPPORTED_LEGACY_REVISION",
  "PUBLICATION_COMMAND_CONFLICT",
  "PUBLICATION_PRIVILEGES_UNAVAILABLE",
  "SCHEDULE_CONFLICT",
  "CONTENT_CONFLICT",
  "HOMEPAGE_CONFLICT",
]);

function failure(error: unknown) {
  if (error instanceof PrivateDraftUnavailableError) {
    return NextResponse.json(
      {
        error: "Private editing is unavailable",
        code: "PRIVATE_DRAFT_DISABLED",
      },
      { status: 503, headers },
    );
  }

  if (error instanceof ContentForbiddenError) {
    return forbid();
  }

  if (error instanceof ContentNotFoundError) {
    return notfound();
  }

  if (error instanceof z.ZodError) {
    return bad("Invalid private draft");
  }

  if (error instanceof WorkingAggregateConflictError) {
    return NextResponse.json(
      {
        error:
          "Private draft conflict; retain your edits and reload before retrying",
        code: conflictReasons.has(error.message)
          ? error.message
          : "BASE_CONFLICT",
      },
      { status: 409, headers },
    );
  }

  return oops(error);
}

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (_req, { params }, { session }) => {
    try {
      await requirePrivateDraftAdmission(prisma);
      const id = idSchema.parse(params.id);

      const draft = await loadWorkingAggregate(prisma, id, session.user, {
        includeSourceMetadata: true,
      });

      return NextResponse.json(draft, { headers });
    } catch (error) {
      return failure(error);
    }
  },
);

export const PUT = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (req, { params }, { session }) => {
    try {
      await requirePrivateDraftAdmission(prisma);
      const pageId = idSchema.parse(params.id);
      let input: unknown;

      try {
        input = await req.json();
      } catch {
        return bad("Invalid JSON");
      }

      const command = requestSchema.parse(input);

      const draft = await saveWorkingAggregate(
        prisma,
        { ...command, pageId },
        session.user,
      );

      return NextResponse.json(draft, { headers });
    } catch (error) {
      return failure(error);
    }
  },
  "content",
);
