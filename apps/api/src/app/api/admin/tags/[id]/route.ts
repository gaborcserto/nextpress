export const runtime = "nodejs";

import { ok, bad, conflict, oops, notfound } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import {
  deleteCategoryService,
  deleteTagService,
  updateTagService,
  ValidationError,
  NotFoundError,
  TaxonomyConflictError,
} from "@/lib/services/tag.server";

export const PATCH = withAuth(
  ["ADMIN", "EDITOR"],
  async (request, { params }) => {
    try {
      return ok(await updateTagService(params.id, await request.json()));
    } catch (error) {
      if (error instanceof ValidationError) {
        return bad(error.message);
      }

      if (error instanceof NotFoundError) {
        return notfound(error.message);
      }

      return oops(error);
    }
  },
  "taxonomy",
);

export const DELETE = withAuth(
  ["ADMIN", "EDITOR"],
  async (request, { params }) => {
    const types = new URL(request.url).searchParams.getAll("type");

    if (types.length > 1 || (types.length === 1 && types[0] !== "CATEGORY")) {
      return bad("Invalid taxonomy type");
    }

    try {
      if (types[0] === "CATEGORY") {
        await deleteCategoryService(params.id);
      } else {
        await deleteTagService(params.id);
      }

      return ok({ message: "Deleted successfully" });
    } catch (err) {
      if (err instanceof ValidationError) {
        return bad(err.message);
      }

      if (err instanceof NotFoundError) {
        return notfound(err.message);
      }

      if (err instanceof TaxonomyConflictError) {
        return conflict(err.message);
      }

      return oops(err);
    }
  },
  "taxonomy",
);
