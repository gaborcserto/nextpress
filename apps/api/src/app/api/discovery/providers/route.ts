import { ProviderDiscoverySchema } from "@nextpress/shared/api-contracts";

import { ok, internalError } from "@/lib/api/http";
import { withRequestLogging } from "@/lib/api/request-logging.server";
import { getOperationalOAuthProviders } from "@/lib/auth/auth-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function get() {
  try {
    const data = ProviderDiscoverySchema.parse({
      providers: await getOperationalOAuthProviders(),
    });
    const response = ok(data);
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  } catch (error) {
    return internalError(error);
  }
}

export const GET = withRequestLogging("discovery", get);
