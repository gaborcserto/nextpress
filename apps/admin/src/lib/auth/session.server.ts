import "server-only";
import {
  SessionDiscoverySchema,
  ProviderDiscoverySchema,
} from "@nextpress/shared/api-contracts";
import {
  renderRequestId,
  responseRequestId,
  setUpstreamRequestId,
} from "@nextpress/shared/request-correlation";
import {
  writeServerLog,
  type FailureCode,
} from "@nextpress/shared/server-logging";
import { headers } from "next/headers";
import { cache } from "react";

import { apiOrigin } from "@/lib/api/upstream.server";

import type { RoleName } from "./roles";

async function discovery<T>(
  path: "session" | "providers",
  parse: (body: unknown) => T,
) {
  const incoming = await headers();

  const cookie = (incoming.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => /^(?:__Secure-)?better-auth[.]/.test(part))
    .join("; ");

  const outgoing = new Headers({ cookie });
  const requestId = renderRequestId(incoming);
  setUpstreamRequestId(outgoing, requestId);

  let correlationId = requestId;
  let code: FailureCode = "transport";
  let status: number | undefined;

  try {
    const response = await fetch(`${apiOrigin()}/api/discovery/${path}`, {
      headers: outgoing,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    correlationId = responseRequestId(response.headers, requestId);
    status = response.status;

    if (!response.ok) {
      code = "upstream";
      throw new Error("API discovery unavailable");
    }

    code = "contract";

    return parse(await response.json());
  } catch (error) {
    writeServerLog("admin", "admin.upstream.failed", {
      requestId,
      upstreamRequestId: correlationId,
      operation: "discovery",
      code,
      status,
    });
    throw error;
  }
}

export const getSessionWithRole = cache(async () => {
  const { user } = await discovery("session", SessionDiscoverySchema.parse);

  return user ? { user } : null;
});
export const getOperationalOAuthProviders = cache(async () => {
  const { providers } = await discovery(
    "providers",
    ProviderDiscoverySchema.parse,
  );

  return providers;
});
// Presentation only: every protected operation is authorized by the API.
export function hasAnyRole(
  role: RoleName | null | undefined,
  allowed: readonly RoleName[],
): role is RoleName {
  return !!role && allowed.includes(role);
}
