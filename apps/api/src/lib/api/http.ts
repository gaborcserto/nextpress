import { NextResponse } from "next/server";

import { workingPersistenceFailure } from "@/lib/services/working-persistence-errors";

type ErrorBody<E extends object = object> = { error: string } & E;

/**
 * Successful JSON response helper.
 */
export function ok<T>(data: T, status?: number): NextResponse<T> {
  return NextResponse.json<T>(data, status ? { status } : undefined);
}

/**
 * 400 Bad Request with optional extra fields.
 */
export function bad<E extends object = object>(
  msg = "Bad Request",
  extra?: E,
): NextResponse<ErrorBody<E>> {
  const body = extra ? { error: msg, ...extra } : { error: msg };

  // TypeScript cannot prove that the branch without `extra` contains an
  // arbitrary caller-supplied E; the response contract is still enforced at
  // this typed helper boundary.
  return NextResponse.json<ErrorBody<E>>(body as ErrorBody<E>, { status: 400 });
}

/**
 * 401 Unauthorized.
 */
export function unauthorized(msg = "Unauthorized"): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>({ error: msg }, { status: 401 });
}

/**
 * 403 Forbidden.
 */
export function forbid(msg = "Forbidden"): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>({ error: msg }, { status: 403 });
}

/**
 * 404 Not Found.
 */
export function notfound(msg = "Not Found"): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>({ error: msg }, { status: 404 });
}

/**
 * 409 Conflict.
 */
export function conflict(msg = "Conflict"): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>({ error: msg }, { status: 409 });
}

/**
 * 500 Internal Server Error.
 */
export function oops(error?: unknown): NextResponse<ErrorBody> {
  if (workingPersistenceFailure(error) === "TRANSACTION_RETRY_REQUIRED") {
    return conflict("Content write conflict; retry the operation");
  }
  const kind = databaseConflictKind(error);

  if (kind === "maintenance") {
    return conflict("Content maintenance conflict; retry after maintenance");
  }

  if (kind === "reference") {
    return conflict("Content is retained by references");
  }

  if (workingPersistenceFailure(error) === "REFERENCE_CONFLICT") {
    return conflict("Content is retained by references");
  }

  if (workingPersistenceFailure(error) === "WRITER_FENCE_CONFLICT") {
    return conflict("Content writer coordination conflict");
  }

  return NextResponse.json<ErrorBody>(
    { error: "Unexpected error" },
    { status: 500 },
  );
}

/** Prisma adapters wrap PostgreSQL diagnostics differently; only known guard codes are exposed. */
function databaseConflictKind(
  error: unknown,
  depth = 0,
): "maintenance" | "reference" | null {
  if (depth > 5 || typeof error !== "object" || error === null) {
    return null;
  }

  for (const [key, value] of Object.entries(error)) {
    if (
      ["code", "originalCode", "sqlState"].includes(key) &&
      typeof value === "string"
    ) {
      if (["P5501", "P5502", "P5503"].includes(value)) {
        return "maintenance";
      }

      if (["P2003", "23001", "23503"].includes(value)) {
        return "reference";
      }
    }

    if (["meta", "cause", "driverAdapterError"].includes(key)) {
      const kind = databaseConflictKind(value, depth + 1);

      if (kind) {
        return kind;
      }
    }
  }

  const held =
    error instanceof Error &&
    /\b(BACKFILL_WRITER_HELD|BACKFILL_COORDINATION_UNAVAILABLE|EDITORIAL_WRITER_OWNED)\b/.test(
      error.message,
    );

  return held ? "maintenance" : null;
}
