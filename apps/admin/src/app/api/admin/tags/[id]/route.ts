export const runtime = "nodejs";

import { ok, bad, oops, notfound } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  deleteTagService,
  ValidationError,
  NotFoundError,
} from "@/lib/services/tag.server";

export const DELETE = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (_req, { params }) => {
    try {
      await deleteTagService(params.id);
      return ok({ message: "Deleted successfully" });
    } catch (err) {
      console.error("DELETE /api/admin/tags/[id] error:", err);

      if (err instanceof ValidationError) return bad(err.message);
      if (err instanceof NotFoundError) return notfound(err.message);

      return oops();
    }
  }
);
