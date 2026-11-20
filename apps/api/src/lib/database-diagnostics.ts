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
      ["code", "errorCode", "originalCode", "sqlState", "kind"].includes(key) &&
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

const unavailableCodes = new Set([
  "P1001",
  "P1002",
  "P1017",
  "08000",
  "08001",
  "08003",
  "08006",
  "57P01",
  "57P02",
  "57P03",
  "DatabaseNotReachable",
  "ConnectionClosed",
  "SocketTimeout",
]);

const adapterNetworkCodes = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

export function isDatabaseUnavailable(error: unknown): boolean {
  // For dual-stack connection failures, Prisma can expose a raw Node error code.
  const prismaRequestError =
    error instanceof Error && error.name === "PrismaClientKnownRequestError";

  for (const code of databaseDiagnostics(error)) {
    if (
      unavailableCodes.has(code) ||
      (prismaRequestError && adapterNetworkCodes.has(code))
    ) {
      return true;
    }
  }

  return false;
}
