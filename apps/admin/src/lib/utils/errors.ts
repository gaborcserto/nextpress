interface SlugConflictError extends Error {
  code: "SLUG_CONFLICT";
}

export function isSlugConflictError(err: unknown): err is SlugConflictError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "SLUG_CONFLICT"
  );
}
