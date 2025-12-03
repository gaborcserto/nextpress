
import { tryCatch, unwrapResult, type Result } from "@nextpress/shared";

/**
 * Thin wrapper around fetch, kept generic and browser-safe.
 */
export async function apiFetch(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, init);
}

/**
 * JSON fetch that returns a Result instead of throwing.
 */
export async function jsonResult<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<Result<T>> {
  // 1) Fetch
  const [res, fetchErr] = await tryCatch<Response>(apiFetch(input, init));

  if (fetchErr || !res) {
    const error =
      fetchErr instanceof Error
        ? fetchErr
        : new Error("Network error while fetching");
    return [null, error];
  }

  // 2) Non-OK HTTP status → also error branch
  if (!res.ok) {
    const [text] = await tryCatch<string>(res.text());
    const error = new Error(text || `Request failed: ${res.status}`);
    return [null, error];
  }

  // 3) Parse JSON
  return tryCatch<T>(await res.json() as Promise<T>);
}

/**
 * JSON fetch that throws on error.
 * Built on top of jsonResult + unwrapResult.
 */
export async function jsonFetcher<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  return unwrapResult(
    await jsonResult<T>(input, init),
    (err: Error) => err
  );
}
