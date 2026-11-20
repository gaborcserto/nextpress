import "server-only";

import {
  apiRequestId,
  requestIdHeader,
} from "@nextpress/shared/request-correlation";
import {
  writeServerLog,
  type FailureCode,
  type LogOperation,
} from "@nextpress/shared/server-logging";
import { serviceUnavailableHeader } from "@nextpress/shared/service-unavailable";
import { ZodError } from "zod";

import { isDatabaseUnavailable } from "@/lib/database-diagnostics";
import { RateLimiter } from "@/lib/security/rate-limit.server";

import { presentBrowserError } from "./browser-error";
import { apiLogContext, requestLog } from "./request-log-context.server";

export function logApiFailure(error: unknown): void {
  const context = apiLogContext();

  if (!context) {
    return;
  }

  let code: FailureCode = "unexpected";

  if (error instanceof ZodError) {
    code = "contract";
  } else if (
    error instanceof Error &&
    [
      "PrismaClientInitializationError",
      "PrismaClientKnownRequestError",
      "PrismaClientUnknownRequestError",
      "DriverAdapterError",
    ].includes(error.name)
  ) {
    code = "database";
  }

  writeServerLog("api", "api.request.failed", {
    ...context,
    code,
    status: 500,
  });
}

const rejectionLogs = new RateLimiter(8);
const rejections: Partial<Record<number, FailureCode>> = {
  400: "validation",
  401: "authentication",
  403: "authorization",
  413: "validation",
  415: "validation",
  422: "validation",
};

export function withRequestLogging<Args extends unknown[]>(
  operation: LogOperation,
  handler: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    const requestId = apiRequestId(request.headers);
    const context = { requestId, operation };

    return requestLog.run(context, async () => {
      let response: Response;

      try {
        response = await handler(request, ...args);
      } catch (error) {
        logApiFailure(error);
        response = Response.json(
          { error: "Unexpected error" },
          {
            status: 500,
            headers: isDatabaseUnavailable(error)
              ? { [serviceUnavailableHeader]: "1" }
              : undefined,
          },
        );
      }

      const { status } = response;
      const code = rejections[status];

      if (code && rejectionLogs.consume(code, 10, 60_000) === null) {
        writeServerLog("api", "api.request.rejected", {
          ...context,
          code,
          status,
        });
      }

      // Delegated responses may have immutable headers, including redirects.
      const headers = new Headers(response.headers);
      headers.set(requestIdHeader, requestId);

      const correlated = new Response(response.body, {
        status,
        statusText: response.statusText,
        headers,
      });

      return presentBrowserError(request, correlated);
    });
  };
}
