export type Result<T, E = Error> = readonly [T | null, E | null];

/**
 * Lightweight wrapper for async/await error handling.
 *
 * Example:
 * const [data, err] = await tryCatch(fetch(...).then(r => r.json()));
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return [data, null] as const;
  } catch (error) {
    return [null, error as E] as const;
  }
}

/**
 * Map the error part of a Result and keep the data as-is.
 */
export function mapResultError<T, E, E2>(
  [data, error]: Result<T, E>,
  mapper: (error: E) => E2
): Result<T, E2> {
  if (!error) return [data, null];
  return [data, mapper(error)];
}

/**
 * Unwrap a Result, throwing a custom error if needed.
 *
 * Example:
 * const user = unwrapResult(result, () => new Error("Failed to load user"));
 */
export function unwrapResult<T, E = Error>(
  [data, error]: Result<T, E>,
  makeError?: (error: E) => Error
): T {
  if (data !== null) return data;

  if (error && makeError) {
    throw makeError(error);
  }

  if (error instanceof Error) {
    throw error;
  }

  throw new Error("Unknown error");
}
