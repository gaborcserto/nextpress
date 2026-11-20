export const serviceUnavailableHeader = "x-nextpress-service-unavailable";

const digestPrefix = "nextpress-unavailable:";

export function serviceUnavailableDigest(): string {
  return digestPrefix + crypto.randomUUID();
}

export function isServiceUnavailable(error: unknown): boolean {
  return (
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith(digestPrefix)
  );
}

export function isUnavailableResponse(response: Response): boolean {
  return (
    [502, 503, 504].includes(response.status) ||
    (response.status === 500 &&
      response.headers.get(serviceUnavailableHeader) === "1")
  );
}
