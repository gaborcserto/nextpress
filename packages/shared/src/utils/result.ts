export type Result<T> = readonly [T, null] | readonly [null, Error];

/** Normalize arbitrary rejection values at the asynchronous boundary. */
export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    return [await promise, null];
  } catch (error) {
    return [
      null,
      error instanceof Error
        ? error
        : new Error("Unknown error", { cause: error }),
    ];
  }
}

export function unwrapResult<T>(
  result: Result<T>,
  makeError?: (error: Error) => Error,
): T {
  if (result[1] !== null) {
    throw makeError ? makeError(result[1]) : result[1];
  }

  return result[0];
}
