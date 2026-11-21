import { ok } from "@/lib/api";
import { withAuth } from "@/lib/auth/auth-server";
import { getDashboardSummary } from "@/lib/repos/dashboardRepo";

export const runtime = "nodejs";

export const GET = withAuth(
  ["ADMIN", "EDITOR", "AUTHOR"],
  async (_request, _context, { session }) => {
    const summary = await getDashboardSummary(session.user);
    const response = ok(summary);
    response.headers.set("Cache-Control", "private, no-store");

    return response;
  },
);
