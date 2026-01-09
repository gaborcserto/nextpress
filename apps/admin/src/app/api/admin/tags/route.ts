export const runtime = "nodejs";

import { ok, oops } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { listTagsWithUsageService } from "@/lib/services/tag.server";

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async () => {
    try {
      const items = await listTagsWithUsageService();
      return ok(items);
    } catch (err) {
      console.error("GET /api/admin/tags error:", err);
      return oops();
    }
  }
);
