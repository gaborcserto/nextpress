/** Read only allowlisted database codes; never return adapter diagnostics to callers. */
export function workingPersistenceFailure(
  error: unknown,
  depth = 0,
): string | null {
  if (depth > 5 || typeof error !== "object" || error === null) {
    return null;
  }

  for (const [key, value] of Object.entries(error)) {
    if (
      ["code", "originalCode", "sqlState"].includes(key) &&
      typeof value === "string"
    ) {
      if (["55P03", "40001", "40P01", "P2034"].includes(value)) {
        return "TRANSACTION_RETRY_REQUIRED";
      }

      if (["23503", "P2003", "P5505"].includes(value)) {
        return "REFERENCE_CONFLICT";
      }

      if (["P5501", "P5502", "P5503", "P5504"].includes(value)) {
        return "WRITER_FENCE_CONFLICT";
      }
    }

    if (["meta", "cause", "driverAdapterError"].includes(key)) {
      const failure = workingPersistenceFailure(value, depth + 1);

      if (failure) {
        return failure;
      }
    }
  }

  return null;
}
