import { ProviderDiscoverySchema } from "@nextpress/shared/api-contracts";

import { ok, oops } from "@/lib/api/http";
import { getOperationalOAuthProviders } from "@/lib/auth/auth-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = ProviderDiscoverySchema.parse({
      providers: await getOperationalOAuthProviders(),
    });
    const response = ok(data);
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  } catch {
    return oops();
  }
}
