import { prisma } from "@nextpress/db/src/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { bad, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  requirePrivateDraftAdmission,
  PrivateDraftUnavailableError,
} from "@/lib/services/private-draft-admission.server";
import { executeDuePrivateReleases } from "@/lib/services/private-release-executor.server";
import { ExecutePrivateReleasesSchema } from "@/lib/validation/private-release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = withAuth(
  ["ADMIN"],
  async (req) => {
    try {
      await requirePrivateDraftAdmission(prisma);
      ExecutePrivateReleasesSchema.parse(await req.json());

      return NextResponse.json(await executeDuePrivateReleases(prisma), {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch (error) {
      if (error instanceof PrivateDraftUnavailableError) {
        return NextResponse.json(
          {
            error: "Private editing is unavailable",
            code: "PRIVATE_DRAFT_DISABLED",
          },
          { status: 503 },
        );
      }

      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        return bad("Expected an empty JSON command");
      }

      return oops(error);
    }
  },
  "content",
);
