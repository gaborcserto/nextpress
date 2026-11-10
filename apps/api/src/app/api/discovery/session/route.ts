import { SessionDiscoverySchema } from "@nextpress/shared/api-contracts";

import { ok, oops } from "@/lib/api/http";
import { getRequestSessionWithRole } from "@/lib/auth/auth-server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getRequestSessionWithRole(req.headers);
    const user = session?.user;
    const data = SessionDiscoverySchema.parse({
      user: user ? { id: user.id, name: user.name, role: user.role } : null,
    });
    const response = ok(data);
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  } catch {
    return oops();
  }
}
