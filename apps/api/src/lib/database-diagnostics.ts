/** Bounded traversal of known adapter wrappers; never expose diagnostic values directly. */
export function* databaseDiagnostics(
  error: unknown,
  depth = 0,
): Generator<string> {
  if (depth > 5 || typeof error !== "object" || error === null) {
    return;
  }

  for (const [key, value] of Object.entries(error)) {
    if (
      ["code", "originalCode", "sqlState"].includes(key) &&
      typeof value === "string"
    ) {
      yield value;
    }

    if (["meta", "cause", "driverAdapterError"].includes(key)) {
      yield* databaseDiagnostics(value, depth + 1);
    }
  }

  if (
    error instanceof Error &&
    /\b(BACKFILL_WRITER_HELD|BACKFILL_COORDINATION_UNAVAILABLE|EDITORIAL_WRITER_OWNED)\b/.test(
      error.message,
    )
  ) {
    yield "BACKFILL_WRITER_HELD";
  }
}
