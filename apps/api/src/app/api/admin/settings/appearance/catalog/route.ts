import { APPEARANCE_CATALOG } from "@nextpress/shared";

import { ok } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";

export const runtime = "nodejs";

export const GET = withAuth(["ADMIN"], async () => ok(APPEARANCE_CATALOG));
