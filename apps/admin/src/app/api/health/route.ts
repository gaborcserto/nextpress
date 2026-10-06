import { ok } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export function GET() {
  const response = ok({ status: "ok" });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
