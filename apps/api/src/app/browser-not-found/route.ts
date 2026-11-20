import { presentBrowserError } from "@/lib/api/browser-error";
import { notfound } from "@/lib/api/http";

export function GET(request: Request): Response {
  return presentBrowserError(request, notfound());
}

// A fallback rewrite may also match a form navigation. Keep its missing-path
// status even though HTML presentation is limited to GET requests.
export { GET as DELETE, GET as OPTIONS, GET as PATCH, GET as POST, GET as PUT };
