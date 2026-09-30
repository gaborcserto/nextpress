import { tryCatch, unwrapResult, type Result } from "@nextpress/shared";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function messageFromBody(body: string, status: number): string {
  if (!body) return `Request failed: ${status}`;

  try {
    const parsed: unknown = JSON.parse(body);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "error" in parsed &&
      typeof parsed.error === "string"
    ) {
      return parsed.error;
    }
  } catch {
    return body;
  }

  return body;
}

export async function apiFetch(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, init);
}

export async function jsonResult<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<Result<T>> {
  const [response, fetchError] = await tryCatch<Response>(apiFetch(input, init));

  if (fetchError || !response) {
    return [
      null,
      fetchError instanceof Error
        ? fetchError
        : new Error("Network error while fetching"),
    ];
  }

  if (!response.ok) {
    const [text] = await tryCatch<string>(response.text());
    return [
      null,
      new ApiRequestError(
        messageFromBody(text ?? "", response.status),
        response.status,
      ),
    ];
  }

  return tryCatch<T>(response.json() as Promise<T>);
}

export async function jsonFetcher<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  return unwrapResult(await jsonResult<T>(input, init), (error: Error) => error);
}
