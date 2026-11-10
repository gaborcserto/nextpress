interface SlugConflictError extends Error {
  code: "SLUG_CONFLICT";
}

export class ContentVersionConflictError extends Error {}

export function isSlugConflictError(err: unknown): err is SlugConflictError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    err.code === "SLUG_CONFLICT"
  );
}
