import { NextResponse } from "next/server";

type ErrorBody<E extends object = {}> = { error: string } & E;

/**
 * Successful JSON response helper.
 */
export function ok<T>(data: T, status?: number): NextResponse<T> {
  return NextResponse.json<T>(
    data,
    status ? { status } : undefined
  );
}

/**
 * 400 Bad Request with optional extra fields.
 */
export function bad<E extends object = {}>(
  msg = "Bad Request",
  extra?: E
): NextResponse<ErrorBody<E>> {
  const body = (
    extra
      ? { error: msg, ...extra }
      : { error: msg }
  ) as ErrorBody<E>;

  return NextResponse.json<ErrorBody<E>>(body, { status: 400 });
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
export function oops(): NextResponse<ErrorBody> {
  return NextResponse.json<ErrorBody>(
    { error: "Unexpected error" },
    { status: 500 }
  );
}
