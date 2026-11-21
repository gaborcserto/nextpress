import {
  ContentForbiddenError,
  ContentNotFoundError,
} from "@/lib/auth/content-access";
import { MediaSelectionError } from "@/lib/repos/pageRepo";
import { TaxonomyScopeError } from "@/lib/repos/tagRepo";
import {
  PageConflictError,
  PageValidationError,
} from "@/lib/services/content.shared";

import { bad, conflict, forbid, notfound, oops } from "./http";

export function contentMutationError(
  error: unknown,
  operation: "create" | "update" | "delete",
) {
  if (error instanceof ContentForbiddenError) {
    return forbid();
  }

  if (operation !== "create" && error instanceof ContentNotFoundError) {
    return notfound();
  }

  if (operation !== "delete") {
    if (error instanceof MediaSelectionError) {
      return bad("One or more selected media assets are unavailable");
    }

    if (error instanceof TaxonomyScopeError) {
      return bad(error.message);
    }

    if (error instanceof PageValidationError) {
      return bad(error.message, { issues: error.issues });
    }

    if (error instanceof PageConflictError) {
      return conflict(error.message);
    }
  }

  return oops(error);
}
