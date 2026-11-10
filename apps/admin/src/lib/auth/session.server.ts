import "server-only";
import {
  SessionDiscoverySchema,
  ProviderDiscoverySchema,
} from "@nextpress/shared/api-contracts";
import { headers } from "next/headers";
import { cache } from "react";

import { apiOrigin } from "@/lib/api/upstream.server";

import type { RoleName } from "./roles";

async function discovery(path: string) {
  const incoming = await headers();
  const cookie = (incoming.get("cookie") ?? "")
    .split(";")
    .map((part) => part.trim())
    .filter((part) => /^(?:__Secure-)?better-auth[.]/.test(part))
    .join("; ");
  const response = await fetch(`${apiOrigin()}/api/discovery/${path}`, {
    headers: { cookie },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error("API discovery unavailable");
  const body: unknown = await response.json();

  return body;
}

export const getSessionWithRole = cache(async () => {
  const { user } = SessionDiscoverySchema.parse(await discovery("session"));

  return user ? { user } : null;
});
export const getOperationalOAuthProviders = cache(async () => {
  return ProviderDiscoverySchema.parse(await discovery("providers")).providers;
});
// Presentation only: every protected operation is authorized by the API.
export function hasAnyRole(
  role: RoleName | null | undefined,
  allowed: readonly RoleName[],
): role is RoleName {
  return !!role && allowed.includes(role);
}
