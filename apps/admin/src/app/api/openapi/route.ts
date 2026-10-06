import { openApiDocument } from "@/lib/api/openapi";

export const dynamic = "force-dynamic";

export function GET() {
  if (process.env.NODE_ENV !== "development") {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(JSON.stringify(openApiDocument, null, 2), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
